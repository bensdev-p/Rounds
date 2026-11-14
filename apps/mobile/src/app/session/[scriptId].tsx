/**
 * One pimp session, start to finish (DESIGN.md → The session, start to finish):
 * asking → (list feedback) → … → the miss (or the top) → result → promotion.
 * The result replaces the session in place, so the run's state stays here.
 */
import {
  buildMissCard,
  currentQuestion,
  detectPhi,
  gradeLocally,
  ladderScore,
  masteryFor,
  PERSONAS,
  personaLine,
  phiWarning,
  pickLadder,
  pickScript,
  RUNGS,
  rungIndex,
  startLadder,
  submitAnswer,
  summarizeResult,
  type Confusable,
  type GradeResult,
  type IllnessScript,
  type LadderState,
  type PersonaId,
  type Question,
  type ResultSummary,
  type SessionRecord,
  type SubmittedAnswer,
} from '@rounds/shared';
import {
  getLadderContent,
  GradeRejectedError,
  gradeAnswer,
  lastAskedQuestionIds,
  listFinishedSessions,
  listPimpableScripts,
  type ScriptSummary,
} from '@rounds/shared/api';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ErrorView, Loading } from '@/components/StatusView';
import { FlagSheet, type FlagTarget } from '@/features/flag/FlagSheet';
import { AskingView } from '@/features/session/AskingView';
import { ListFeedbackView } from '@/features/session/ListFeedbackView';
import { PromotionView } from '@/features/session/PromotionView';
import { ResultView } from '@/features/session/ResultView';
import { useClient } from '@/lib/auth';
import { ROTATION_NAMES } from '@/lib/copy';
import { rungPassHaptic } from '@/lib/haptics';
import { parsePersona, useRoundsGoal } from '@/lib/prefs';
import { useAsync } from '@/lib/useAsync';
import { useLadderRecorder } from '@/lib/useLadderRecorder';
import { rungStates } from '@/ui/Ladder';
import { loadErrorMessage } from '@/lib/errors';

/** How long the missed rung shows before the result replaces the session. */
const MISS_HOLD_MS = 1_000;
/** After the last rung passes, long enough to see it fill. */
const TOP_HOLD_MS = 700;

function goHome() {
  router.dismissTo('/');
}

export default function SessionRoute() {
  const client = useClient();
  const params = useLocalSearchParams<{ scriptId: string; persona?: string }>();
  const persona = parsePersona(params.persona) ?? 'teacher';
  const data = useAsync(async () => {
    const [content, sessions, scripts, lastAsked] = await Promise.all([
      getLadderContent(client, params.scriptId),
      listFinishedSessions(client),
      listPimpableScripts(client),
      lastAskedQuestionIds(client, params.scriptId),
    ]);
    return { content, sessions, scripts, lastAsked };
  }, params.scriptId);

  if (data.status === 'loading') return <Loading label="Getting the attending" />;
  if (data.status === 'error') {
    return (
      <ErrorView
        message={loadErrorMessage("Couldn't load this topic.", data.error)}
        onRetry={data.reload}
      />
    );
  }
  const { content, sessions, scripts, lastAsked } = data.data;
  if (!content || content.questions.length === 0) {
    return <ErrorView message="That topic isn't available." onRetry={goHome} />;
  }
  return (
    <Session
      script={content.script}
      questions={content.questions}
      confusables={content.confusables}
      sessionsBefore={sessions}
      scripts={scripts}
      lastAsked={lastAsked}
      persona={persona}
    />
  );
}

type Phase = 'asking' | 'missed' | 'list' | 'result' | 'promotion';

interface LastAnswer {
  question: Question;
  answer: string;
  result: GradeResult;
}

function Session({
  script,
  questions,
  confusables,
  sessionsBefore,
  scripts,
  lastAsked,
  persona,
}: {
  script: IllnessScript;
  /** Every question on the script; each run asks one per rung. */
  questions: Question[];
  confusables: Confusable[];
  sessionsBefore: SessionRecord[];
  scripts: ScriptSummary[];
  /** Questions from the last finished session on this script, to avoid repeating. */
  lastAsked: string[];
  persona: PersonaId;
}) {
  const client = useClient();
  const [state, setState] = useState<LadderState>(() =>
    startLadder(pickLadder(questions, { avoid: lastAsked }), persona),
  );
  const recorder = useLadderRecorder(client, script, persona);
  const [phase, setPhase] = useState<Phase>('asking');
  const [answer, setAnswer] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);
  const [last, setLast] = useState<LastAnswer | null>(null);
  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const [flagTarget, setFlagTarget] = useState<FlagTarget | null>(null);
  const [goal] = useRoundsGoal();
  // Finished sessions so far, including runs in this screen ("Go again").
  const [history, setHistory] = useState<SessionRecord[]>(sessionsBefore);

  // Bumped on restart so a grade or timer that arrives late is ignored.
  const run = useRef(0);
  // When the current question appeared, for the persona time limit.
  const shownAt = useRef(0);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);
  // The clock runs from the first question until the miss or the top.
  const [clock, setClock] = useState(() => ({ start: Date.now(), stop: null as number | null }));
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (clock.stop !== null) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [clock.stop]);
  const clockMs = (clock.stop ?? now) - clock.start;

  const question = currentQuestion(state);
  const personaLabel = PERSONAS[persona].label;

  function finish(final: LadderState, runAtFinish: number) {
    const endedAt = new Date();
    const record: SessionRecord = {
      script_id: script.id,
      score: ladderScore(final),
      status: final.status === 'completed' ? 'completed' : 'missed',
      ended_at: endedAt.toISOString(),
    };
    const result = summarizeResult({
      before: history,
      session: record,
      anyPartial: final.attempts.some((a) => a.grade === 'partial'),
      now: endedAt,
      goal,
    });
    setHistory([...history, record]);
    setSummary(result);
    setClock((c) => ({ ...c, stop: Date.now() }));
    setTimeout(
      () => {
        if (run.current === runAtFinish) setPhase((p) => (p === 'list' ? p : 'result'));
      },
      final.status === 'completed' ? TOP_HOLD_MS : MISS_HOLD_MS,
    );
  }

  async function submit(dontKnow = false) {
    if (!question || grading || phase !== 'asking') return;
    const text = dontKnow ? '' : answer;
    if (!dontKnow && !text.trim()) return;
    const phi = phiWarning(detectPhi(text));
    if (phi) {
      setWarning(phi);
      return;
    }
    // Time to answer stops at submit; grading time doesn't count against the student.
    const elapsed_ms = Date.now() - shownAt.current;
    const runAtSubmit = run.current;
    let graded: Pick<SubmittedAnswer, 'result' | 'grader' | 'grader_version'>;
    if (dontKnow) {
      graded = { result: gradeLocally(question, '', confusables), grader: 'local' };
    } else {
      setGrading(true);
      try {
        graded = await gradeAnswer(client, question.id, text);
      } catch (error) {
        if (run.current !== runAtSubmit) return;
        if (error instanceof GradeRejectedError) {
          setGrading(false);
          setWarning(
            'That answer looks like it contains patient details. Remove them and try again.',
          );
          return;
        }
        // Server unreachable: grade on the device so the ladder keeps moving.
        graded = { result: gradeLocally(question, text, confusables), grader: 'local' };
      }
      if (run.current !== runAtSubmit) return;
    }

    const next = submitAnswer(state, { answer: text, elapsed_ms, ...graded });
    const attempt = next.attempts.at(-1);
    if (attempt) recorder.record(attempt);
    if (next.status !== 'in_progress') recorder.finish(next);

    setState(next);
    setLast({ question, answer: text, result: graded.result });
    setGrading(false);
    setWarning(null);
    shownAt.current = Date.now();

    if (attempt?.passed) {
      rungPassHaptic();
      setAnswer('');
      if (question.kind === 'list') setPhase('list');
    } else {
      // Keep the answer on screen while the miss shows.
      setPhase('missed');
    }
    if (next.status !== 'in_progress') finish(next, runAtSubmit);
  }

  function nextFromList() {
    shownAt.current = Date.now();
    setPhase(state.status === 'in_progress' ? 'asking' : 'result');
  }

  function goAgain() {
    run.current += 1;
    recorder.reset();
    // Ask different questions from the run that just ended, where the script has them.
    const justAsked = state.attempts.map((a) => a.question_id);
    setState(startLadder(pickLadder(questions, { avoid: justAsked }), persona));
    setPhase('asking');
    setAnswer('');
    setWarning(null);
    setGrading(false);
    setLast(null);
    setSummary(null);
    shownAt.current = Date.now();
    setClock({ start: Date.now(), stop: null });
  }

  function nextTopic() {
    // Stay in this script's rotation.
    const rotation = script.rotation[0];
    const scriptId = pickScript(
      scripts
        .filter((s) => rotation === undefined || s.script.rotation.includes(rotation))
        .map((s) => s.script.id),
      history,
      { exclude: script.id },
    );
    if (!scriptId || scriptId === script.id) {
      goAgain();
      return;
    }
    router.replace({ pathname: '/session/[scriptId]', params: { scriptId, persona } });
  }

  /** "This is wrong": choose among the questions asked in this run, the last one first. */
  function reportProblem() {
    const asked = state.attempts
      .map((a) => questions.find((q) => q.id === a.question_id))
      .filter((q): q is Question => q !== undefined);
    setFlagTarget({
      script: { id: script.id, version: script.version, name: script.name },
      questions: asked.map((q) => ({ id: q.id, prompt: q.prompt })),
      initialQuestionId: asked.at(-1)?.id,
      reasons: ['marked_wrong', 'unclear', 'script_error', 'other'],
    });
  }

  function reviewScript() {
    router.push({ pathname: '/script/[scriptId]', params: { scriptId: script.id, persona } });
  }

  // ─── Views ────────────────────────────────────────────────────────────────

  if (phase === 'promotion' && summary) {
    // History always holds this session by now, so there is a first one.
    const first = history[0]?.ended_at ?? history.at(-1)?.ended_at ?? '';
    return (
      <PromotionView
        rank={summary.rankAfter}
        since={new Date(first).toLocaleDateString('en-US', { month: 'long' })}
        personaLine={personaLine(persona, 'promotion', summary.rankAfter.index)}
        personaName={personaLabel}
        onDone={goHome}
      />
    );
  }

  if (phase === 'result' && summary) {
    const missAttempt = state.status === 'missed' ? state.attempts.at(-1) : undefined;
    const missCard =
      missAttempt && last
        ? buildMissCard({
            answer: last.answer,
            result: last.result,
            missTag: missAttempt.miss_tag,
            question: last.question,
            script,
            confusables,
            persona,
          })
        : null;
    const rotation = script.rotation[0] ?? 'IM';
    const inRotation = scripts.filter((s) => s.script.rotation.includes(rotation));
    const endedAt = new Date(history.at(-1)?.ended_at ?? '');
    return (
      <>
        <ResultView
          scriptName={script.name}
          inReview={script.status === 'in_review'}
          summary={summary}
          missCard={missCard}
          personaLine={
            summary.completed ? personaLine(persona, 'top', summary.rankAfter.totalRungs) : null
          }
          mastery={
            summary.completed
              ? {
                  rotation: ROTATION_NAMES[rotation],
                  mastered: inRotation.filter(
                    (s) => masteryFor(s.script.id, history, endedAt) === 'mastered',
                  ).length,
                  total: inRotation.length,
                }
              : null
          }
          saveFailed={recorder.save.status === 'error'}
          onReviewScript={reviewScript}
          onReportProblem={reportProblem}
          onDone={summary.promoted ? () => setPhase('promotion') : goHome}
          onPrimary={
            summary.promoted ? () => setPhase('promotion') : summary.completed ? nextTopic : goAgain
          }
          primaryLabel={
            summary.promoted ? 'Continue' : summary.completed ? 'Next topic' : 'Go again'
          }
        />
        <FlagSheet target={flagTarget} onClose={() => setFlagTarget(null)} />
      </>
    );
  }

  if (phase === 'list' && last && last.question.kind === 'list') {
    return (
      <ListFeedbackView
        persona={persona}
        personaLabel={personaLabel}
        clockMs={clockMs}
        scriptName={script.name}
        inReview={script.status === 'in_review'}
        rungNumber={rungIndex(last.question.rung) + 1}
        question={last.question}
        result={last.result}
        last={state.status !== 'in_progress'}
        onNext={nextFromList}
        onClose={goHome}
      />
    );
  }

  // Asking, or holding on the miss. During the miss hold, show the missed question.
  const shownQuestion = phase === 'missed' && last ? last.question : question;
  const score = ladderScore(state);
  const rungs =
    state.status === 'missed'
      ? rungStates(score, 'miss')
      : rungStates(score, score < RUNGS.length ? 'now' : 'none');

  return (
    <AskingView
      personaLabel={personaLabel}
      clockMs={clockMs}
      rungs={rungs}
      scriptName={script.name}
      inReview={script.status === 'in_review'}
      prompt={shownQuestion?.prompt ?? ''}
      isList={shownQuestion?.kind === 'list'}
      answer={answer}
      onChangeAnswer={(text) => {
        setAnswer(text);
        if (warning) setWarning(null);
      }}
      onSubmit={() => void submit()}
      onDontKnow={() => void submit(true)}
      onClose={goHome}
      grading={grading}
      locked={phase === 'missed' || state.status !== 'in_progress'}
      warning={warning}
    />
  );
}
