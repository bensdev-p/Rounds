/**
 * The mix-up drill, from Review's "Drill this pair" (review.png, video scene
 * 7). Both scripts' "Tell it apart" questions, taking turns, up to four. It
 * ends on the first miss, like the ladder, and is saved as a drill: it never
 * counts toward best rung, rounds, rank or mastery.
 */
import {
  buildMissCard,
  comparisonRows,
  detectPhi,
  drillQuestion,
  drillScore,
  drillTimeUp,
  gradeLocally,
  PERSONAS,
  phiWarning,
  pickDrill,
  startDrill,
  submitDrillAnswer,
  TIME_UP_RESULT,
  type DrillState,
  type GradeResult,
  type PersonaId,
  type Question,
  type SubmittedAnswer,
} from '@rounds/shared';
import {
  getLadderContent,
  GradeRejectedError,
  gradeAnswer,
  type LadderContent,
} from '@rounds/shared/api';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ErrorView, Loading } from '@/components/StatusView';
import { FlagSheet, type FlagTarget } from '@/features/flag/FlagSheet';
import { DrillResultView } from '@/features/review/DrillResultView';
import { AskingView } from '@/features/session/AskingView';
import { useQuestionClock } from '@/features/session/useQuestionClock';
import { useClient } from '@/lib/auth';
import { loadErrorMessage } from '@/lib/errors';
import { rungPassHaptic } from '@/lib/haptics';
import { parsePersona } from '@/lib/prefs';
import { useTimeLimit } from '@/lib/profile';
import { useAsync } from '@/lib/useAsync';
import { useDrillRecorder } from '@/lib/useLadderRecorder';
import type { RungState } from '@/ui/Ladder';

/** How long the miss shows before the result replaces the drill. */
const MISS_HOLD_MS = 1_000;
const TOP_HOLD_MS = 700;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/review');
}

export default function DrillRoute() {
  const client = useClient();
  const params = useLocalSearchParams<{ a: string; b: string; persona?: string }>();
  const persona = parsePersona(params.persona) ?? 'teacher';
  const data = useAsync(async () => {
    const [left, right] = await Promise.all([
      getLadderContent(client, params.a),
      getLadderContent(client, params.b),
    ]);
    return { left, right };
  }, `${params.a}|${params.b}`);

  if (data.status === 'loading') return <Loading label="Getting the attending" />;
  if (data.status === 'error') {
    return (
      <ErrorView
        message={loadErrorMessage("Couldn't load this pair.", data.error)}
        onRetry={data.reload}
      />
    );
  }
  const { left, right } = data.data;
  if (!left || !right) return <ErrorView message="That pair isn't available." onRetry={goBack} />;
  if (pickDrill(left.questions, right.questions).length === 0) {
    return <ErrorView message="This pair has no tell-apart questions yet." onRetry={goBack} />;
  }
  return <Drill left={left} right={right} persona={persona} />;
}

type Phase = 'asking' | 'missed' | 'result';

interface LastAnswer {
  question: Question;
  answer: string;
  result: GradeResult;
}

function stepStates(state: DrillState): RungState[] {
  return state.questions.map((_, i) => {
    const attempt = state.attempts[i];
    if (attempt) return attempt.passed ? 'done' : 'miss';
    return i === state.index && state.status === 'in_progress' ? 'now' : 'dim';
  });
}

function Drill({
  left,
  right,
  persona,
}: {
  left: LadderContent;
  right: LadderContent;
  persona: PersonaId;
}) {
  const client = useClient();
  const timeLimit = useTimeLimit(persona);
  const pick = () =>
    startDrill(
      [left.script.id, right.script.id],
      pickDrill(left.questions, right.questions),
      persona,
      { time_limit_ms: timeLimit },
    );
  const [state, setState] = useState<DrillState>(pick);
  const recorder = useDrillRecorder(client, left.script, right.script.id, persona);
  const [phase, setPhase] = useState<Phase>('asking');
  const [answer, setAnswer] = useState('');
  const [warning, setWarning] = useState<string | null>(null);
  const [grading, setGrading] = useState(false);
  const [last, setLast] = useState<LastAnswer | null>(null);
  const [flagTarget, setFlagTarget] = useState<FlagTarget | null>(null);

  const run = useRef(0);

  const contentFor = (scriptId: string): LadderContent =>
    scriptId === right.script.id ? right : left;
  const question = drillQuestion(state);

  // Like the session: a timed attending counts down per question, holding
  // while an answer is graded; untimed, the clock counts up.
  const questionKey = `${run.current}|${question?.id ?? state.attempts.at(-1)?.question_id}`;
  const clock = useQuestionClock({
    timeLimitMs: state.time_limit_ms,
    runKey: run.current,
    questionKey,
    running: phase === 'asking' && state.status === 'in_progress' && !grading,
    ended: state.status !== 'in_progress',
  });
  const personaLabel = PERSONAS[persona].label;
  const title = 'Mix-up drill';

  async function submit(dontKnow = false) {
    if (!question || grading || phase !== 'asking') return;
    const text = dontKnow ? '' : answer;
    if (!dontKnow && !text.trim()) return;
    const phi = phiWarning(detectPhi(text));
    if (phi) {
      setWarning(phi);
      return;
    }
    const elapsed_ms = clock.answerMs();
    const runAtSubmit = run.current;
    const { confusables } = contentFor(question.script_id);
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
        graded = { result: gradeLocally(question, text, confusables), grader: 'local' };
      }
      if (run.current !== runAtSubmit) return;
    }

    const next = submitDrillAnswer(state, { answer: text, elapsed_ms, ...graded });
    const attempt = next.attempts.at(-1);
    if (attempt) recorder.record(attempt);
    if (next.status !== 'in_progress') recorder.finish(next);

    setState(next);
    setLast({ question, answer: text, result: graded.result });
    setGrading(false);
    setWarning(null);

    if (attempt?.passed) {
      rungPassHaptic();
      setAnswer('');
    } else {
      setPhase('missed');
    }
    if (next.status !== 'in_progress') showResultAfterHold(next, runAtSubmit);
  }

  function showResultAfterHold(final: DrillState, runAtEnd: number) {
    setTimeout(
      () => {
        if (run.current === runAtEnd) setPhase('result');
      },
      final.status === 'completed' ? TOP_HOLD_MS : MISS_HOLD_MS,
    );
  }

  // 0:00 before an answer was sent: the drill ends on a slow miss, "Time's up".
  const expired = useRef<string | null>(null);
  useEffect(() => {
    if (!clock.timeUp || !question || phase !== 'asking' || grading) return;
    if (expired.current === questionKey) return;
    expired.current = questionKey;
    const next = drillTimeUp(state);
    const attempt = next.attempts.at(-1);
    if (attempt) recorder.record(attempt);
    recorder.finish(next);
    setState(next);
    setLast({ question, answer: '', result: TIME_UP_RESULT });
    setWarning(null);
    setPhase('missed');
    showResultAfterHold(next, run.current);
    // Runs when the clock reaches 0:00; the rest is read fresh from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.timeUp, questionKey, phase, grading]);

  function goAgain() {
    run.current += 1;
    recorder.reset();
    setState(pick());
    setPhase('asking');
    setAnswer('');
    setWarning(null);
    setGrading(false);
    setLast(null);
  }

  function reportProblem() {
    // Flag within the script of the last question asked.
    const lastQuestion = last?.question ?? state.questions[0]!;
    const script = contentFor(lastQuestion.script_id).script;
    const asked = state.attempts
      .map((a) => state.questions.find((q) => q.id === a.question_id))
      .filter((q): q is Question => q !== undefined && q.script_id === script.id);
    setFlagTarget({
      script: { id: script.id, version: script.version, name: script.name },
      questions: asked.map((q) => ({ id: q.id, prompt: q.prompt })),
      initialQuestionId: lastQuestion.id,
      reasons: ['marked_wrong', 'unclear', 'script_error', 'other'],
    });
  }

  if (phase === 'result') {
    const missAttempt = state.status === 'missed' ? state.attempts.at(-1) : undefined;
    const missed = missAttempt && last ? contentFor(last.question.script_id) : null;
    const missCard =
      missAttempt && last && missed
        ? buildMissCard({
            answer: last.answer,
            result: last.result,
            missTag: missAttempt.miss_tag,
            question: last.question,
            script: missed.script,
            confusables: missed.confusables,
            persona,
            timeLimitMs: state.time_limit_ms,
          })
        : null;
    return (
      <>
        <DrillResultView
          title={title}
          steps={stepStates(state)}
          score={drillScore(state)}
          total={state.questions.length}
          missCard={missCard}
          inReview={missed?.script.status === 'in_review'}
          comparison={{
            leftName: left.script.name,
            rightName: right.script.name,
            rows: comparisonRows(left.script, right.script),
            fallback:
              left.script.confused_with.find((l) => l.script_id === right.script.id)
                ?.how_to_tell_apart ?? null,
          }}
          saveFailed={recorder.save.status === 'error'}
          onReviewScript={(scriptId) =>
            router.push({ pathname: '/script/[scriptId]', params: { scriptId } })
          }
          onReportProblem={reportProblem}
          onDone={goBack}
          onAgain={goAgain}
        />
        <FlagSheet target={flagTarget} onClose={() => setFlagTarget(null)} />
      </>
    );
  }

  const shownQuestion = phase === 'missed' && last ? last.question : question;
  const shownScript = shownQuestion ? contentFor(shownQuestion.script_id).script : left.script;
  const answered = drillScore(state);
  const total = state.questions.length;
  return (
    <AskingView
      personaLabel={personaLabel}
      clock={clock}
      rungs={[]}
      steps={{
        states: stepStates(state),
        label:
          state.status === 'missed'
            ? `Drill: ${answered} of ${total} told apart, then a miss`
            : `Drill: question ${Math.min(state.index + 1, total)} of ${total}`,
      }}
      dontKnowHint="Ends the drill on this question"
      scriptName={shownScript.name}
      inReview={shownScript.status === 'in_review'}
      prompt={shownQuestion?.prompt ?? ''}
      isList={shownQuestion?.kind === 'list'}
      answer={answer}
      onChangeAnswer={(text) => {
        setAnswer(text);
        if (warning) setWarning(null);
      }}
      onSubmit={() => void submit()}
      onDontKnow={() => void submit(true)}
      onClose={goBack}
      grading={grading}
      locked={phase === 'missed' || state.status !== 'in_progress'}
      warning={warning}
    />
  );
}
