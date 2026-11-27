'use client';
import {
  buildMissCard,
  clearedRungs,
  currentQuestion,
  detectPhi,
  endingMiss,
  gradeLocally,
  localDayKey,
  longDay,
  MAX_ANSWER_LENGTH,
  PERSONAS,
  phiWarning,
  pickDailyLadder,
  pickDailyScript,
  startLadder,
  submitAnswer,
  timeUp,
  type DayKey,
  type GradeResult,
  type LadderState,
  type SubmittedAnswer,
} from '@rounds/shared';
import {
  finishSession,
  getDailyContent,
  getDailyPool,
  gradeAnswer,
  GradeRejectedError,
  isTester,
  recordAttempt,
  startSession,
  type LadderContent,
  type RoundsClient,
} from '@rounds/shared/api';
import { Info, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Ladder, type RungState } from '../../components/Ladder.tsx';
import { supabase } from '../../lib/supabase.ts';
import { DailyResult } from './DailyResult.tsx';
import { loadRun, saveRun, type SavedRun } from './saved.ts';
import { TesterSignIn } from './TesterSignIn.tsx';

/**
 * The same attending for everyone, so scores compare: the Internist, 30
 * seconds a question (developer's decision, 27 Nov 2026). The clock counts
 * down per question; at 0:00 the ladder ends on a slow miss.
 */
const PERSONA = 'internist';
const LIMIT_MS = PERSONAS[PERSONA].time_limit_ms ?? 30_000;

/** What a timed-out rung was "graded": nothing was sent. */
const TIME_UP: GradeResult = {
  grade: 'incorrect',
  reason: 'Time ran out',
  matched: [],
  confused_with_script_id: null,
};

type Account = { kind: 'none' } | { kind: 'anonymous' } | { kind: 'email'; email: string };

type View =
  | { name: 'loading' }
  | { name: 'waiting'; account: Account; tester: boolean }
  | { name: 'playing'; account: Account; content: LadderContent; ladder: LadderState }
  | { name: 'result'; account: Account; run: SavedRun }
  | { name: 'error' };

async function currentAccount(client: RoundsClient): Promise<Account> {
  const { data } = await client.auth.getSession();
  const user = data.session?.user;
  if (!user) return { kind: 'none' };
  if (user.is_anonymous || !user.email) return { kind: 'anonymous' };
  return { kind: 'email', email: user.email };
}

function runFrom(
  day: DayKey,
  content: LadderContent,
  ladder: LadderState,
  last: { answer: string; result: GradeResult } | null,
): SavedRun {
  const miss = endingMiss(ladder);
  const question = miss ? ladder.questions.find((q) => q.id === miss.question_id) : undefined;
  const card =
    miss && question && last
      ? buildMissCard({
          answer: last.answer,
          result: last.result,
          missTag: miss.miss_tag,
          question,
          script: content.script,
          confusables: content.confusables,
          persona: PERSONA,
        })
      : null;
  return {
    day,
    script_id: content.script.id,
    script_name: content.script.name,
    cleared: clearedRungs(ladder).length,
    missed: ladder.status === 'missed',
    total: ladder.questions.length,
    miss: card ? { label: card.label, quote: card.quote, correction: card.correction } : null,
  };
}

/** Keeps a signed-in student's run with their practice in the app. Best effort. */
async function keepWithPractice(client: RoundsClient, content: LadderContent, ladder: LadderState) {
  try {
    const sessionId = await startSession(client, content.script, PERSONA);
    for (const attempt of ladder.attempts) await recordAttempt(client, sessionId, attempt);
    await finishSession(client, sessionId, ladder);
  } catch (error) {
    console.warn('[daily] could not keep the run with your practice', error);
  }
}

export function DailyPimp() {
  const [day] = useState<DayKey>(() => localDayKey(new Date()));
  const [view, setView] = useState<View>({ name: 'loading' });
  const [client] = useState(() => supabase());

  const load = useCallback(async () => {
    if (!client) {
      setView({ name: 'error' });
      return;
    }
    try {
      const account = await currentAccount(client);
      const pool = await getDailyPool(client);
      const scriptId = pickDailyScript(pool, day);
      const content = scriptId ? await getDailyContent(client, scriptId) : null;
      const questions = content ? pickDailyLadder(content.questions, day) : [];
      if (!content || questions.length === 0) {
        const tester = account.kind === 'email' ? await isTester(client) : false;
        setView({ name: 'waiting', account, tester });
        return;
      }
      const saved = loadRun(day, content.script.id);
      if (saved) {
        setView({ name: 'result', account, run: saved });
        return;
      }
      setView({
        name: 'playing',
        account,
        content,
        ladder: startLadder(questions, PERSONA),
      });
    } catch (error) {
      console.warn('[daily] could not load', error);
      setView({ name: 'error' });
    }
  }, [client, day]);

  useEffect(() => {
    void load();
  }, [load]);

  async function signOut() {
    await client?.auth.signOut();
    setView({ name: 'loading' });
    void load();
  }

  if (view.name === 'result') {
    return (
      <section className="section daily">
        <div className="wrap">
          <DailyResult day={day} run={view.run} />
        </div>
      </section>
    );
  }

  const inReview = view.name === 'playing' && view.content.script.status === 'in_review';
  const isPublic = view.name === 'playing' && !inReview;

  return (
    <section className="section daily">
      <div className="wrap split top-align wide-right">
        <div className="stack-lg">
          <p className="meta" suppressHydrationWarning>
            {view.name === 'loading' ? ' ' : longDay(day)}
          </p>
          <h1 className="t-page">Daily pimp</h1>
          <p className="body t2 measure">
            {isPublic
              ? 'One script a day, the same for everyone, no account needed. See how far you get before you’re pimped.'
              : 'One script a day, the same for everyone. See how far you get before you’re pimped.'}
          </p>
          {view.name === 'waiting' ? <WaitingNote view={view} onSignOut={signOut} /> : null}
          {view.name === 'playing' ? (
            <p className="small">
              The {PERSONAS[PERSONA].label} is asking: {Math.round(LIMIT_MS / 1000)} seconds a
              question.
            </p>
          ) : null}
          {view.name === 'playing' ? (
            <AccountLine account={view.account} inReview={inReview} onSignOut={signOut} />
          ) : null}
          {view.name === 'error' ? (
            <div className="info measure" role="alert">
              <Info aria-hidden="true" />
              <p>
                The daily pimp didn&apos;t load. Check your connection and{' '}
                <a href="/daily">try again</a>.
              </p>
            </div>
          ) : null}
        </div>
        {view.name === 'playing' && client ? (
          <PlayPanel
            client={client}
            day={day}
            account={view.account}
            content={view.content}
            initial={view.ladder}
            inReview={inReview}
            onDone={(run) => {
              setView({ name: 'result', account: view.account, run });
              window.scrollTo({ top: 0 });
            }}
          />
        ) : null}
        {view.name === 'waiting' && view.account.kind !== 'email' && client ? (
          <TesterSignIn
            client={client}
            title="Testing PimpMe? Sign in to play"
            note="Use the email from your PimpMe account. We'll send you a 6-digit code."
            onSignedIn={() => {
              setView({ name: 'loading' });
              void load();
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

function WaitingNote({
  view,
  onSignOut,
}: {
  view: Extract<View, { name: 'waiting' }>;
  onSignOut: () => void;
}) {
  const { account, tester } = view;
  return (
    <>
      <div className="info measure">
        <Info aria-hidden="true" />
        {account.kind === 'email' && tester ? (
          <p>
            No daily pimp today: there&apos;s no script ready yet. Practise in the app meanwhile.
          </p>
        ) : account.kind === 'email' ? (
          <p>
            {account.email} isn&apos;t on the tester list yet. The daily pimp opens to everyone once
            the first scripts have been reviewed by a physician.{' '}
            <Link href="/support">Ask for an invite</Link>
          </p>
        ) : (
          <p>
            The daily pimp opens once the first scripts have been reviewed by a physician. Until
            then, testers play here and practise in the app.{' '}
            <Link href="/support">Ask for an invite</Link>
          </p>
        )}
      </div>
      {account.kind === 'email' ? (
        <p className="small">
          Signed in as {account.email}.{' '}
          <button type="button" className="link small" onClick={onSignOut}>
            Sign out
          </button>
        </p>
      ) : null}
    </>
  );
}

function AccountLine({
  account,
  inReview,
  onSignOut,
}: {
  account: Account;
  inReview: boolean;
  onSignOut: () => void;
}) {
  if (account.kind === 'email') {
    return (
      <p className="small">
        {inReview ? 'Testers only until the first scripts are reviewed. ' : ''}Signed in as{' '}
        {account.email}, so your result is kept with your practice.{' '}
        <button type="button" className="link small" onClick={onSignOut}>
          Sign out
        </button>
      </p>
    );
  }
  return <p className="small hide-phone">Sign in and your result is kept with your practice.</p>;
}

/** Time left, rounded up: 0:30 when a question appears, 0:00 when it runs out. */
function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** The game panel (mockups daily-desktop, daily-phone). */
function PlayPanel({
  client,
  day,
  account,
  content,
  initial,
  inReview,
  onDone,
}: {
  client: RoundsClient;
  day: DayKey;
  account: Account;
  content: LadderContent;
  initial: LadderState;
  inReview: boolean;
  onDone: (run: SavedRun) => void;
}) {
  const [ladder, setLadder] = useState(initial);
  const [answer, setAnswer] = useState('');
  const [grading, setGrading] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const shownAt = useRef(Date.now());
  // While an answer is being graded the clock holds where it stopped.
  const [heldAt, setHeldAt] = useState<number | null>(null);
  const finished = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  const question = currentQuestion(ladder);
  const elapsed = heldAt ?? now - shownAt.current;
  const left = LIMIT_MS - elapsed;
  const warning = phiWarning(detectPhi(answer)) ?? rejected;

  const states: RungState[] = ladder.questions.map((_, i) =>
    i < ladder.index ? 'done' : i === ladder.index ? 'now' : '',
  );

  function finish(next: LadderState, last: { answer: string; result: GradeResult }) {
    finished.current = true;
    const run = runFrom(day, content, next, last);
    saveRun(run);
    if (account.kind === 'email') void keepWithPractice(client, content, next);
    onDone(run);
  }

  // 0:00 before an answer was sent: the ladder ends, too slow.
  useEffect(() => {
    if (left > 0 || grading || heldAt !== null || finished.current) return;
    if (ladder.status !== 'in_progress') return;
    finish(timeUp(ladder), { answer: '', result: TIME_UP });
  });

  async function submit(dontKnow: boolean) {
    if (!question || grading || finished.current) return;
    const text = dontKnow ? '' : answer.trim();
    if (!dontKnow && (!text || phiWarning(detectPhi(text)))) return;
    // Time to answer stops at submit; grading time doesn't count.
    const elapsed_ms = Date.now() - shownAt.current;
    let graded: Pick<SubmittedAnswer, 'result' | 'grader' | 'grader_version'>;
    if (dontKnow) {
      graded = { result: gradeLocally(question, '', content.confusables), grader: 'local' };
    } else {
      setGrading(true);
      setHeldAt(elapsed_ms);
      try {
        // Grading needs a session: a visitor with no account gets an anonymous one.
        if (account.kind === 'none') {
          const { data } = await client.auth.getSession();
          if (!data.session) await client.auth.signInAnonymously();
        }
        graded = await gradeAnswer(client, question.id, text);
      } catch (error) {
        if (error instanceof GradeRejectedError) {
          setGrading(false);
          // Back to answering: the clock carries on from where it held.
          shownAt.current = Date.now() - elapsed_ms;
          setHeldAt(null);
          setRejected(
            'That answer looks like it contains patient details. Remove them and try again.',
          );
          return;
        }
        // Server unreachable: grade in the browser so the ladder keeps moving.
        graded = { result: gradeLocally(question, text, content.confusables), grader: 'local' };
      }
    }

    const next = submitAnswer(ladder, { answer: text, elapsed_ms, ...graded });
    if (next.status !== 'in_progress') {
      finish(next, { answer: text, result: graded.result });
      return;
    }
    setGrading(false);
    setRejected(null);
    setAnswer('');
    shownAt.current = Date.now();
    setNow(shownAt.current);
    setHeldAt(null);
    setLadder(next);
    input.current?.focus();
  }

  if (!question) return null;

  return (
    <div className="panel" aria-label="Today's pimp">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="meta">
          {content.script.name}
          {inReview ? <span className="t3"> · Not yet reviewed</span> : null}
        </span>
        <span
          className="num t2"
          style={{ fontSize: 18 }}
          role="timer"
          aria-label={`Time left ${clock(left)}`}
        >
          {clock(left)}
        </span>
      </div>
      <div
        className="hide-phone"
        style={{ display: 'flex', gap: 28, marginTop: 22, alignItems: 'flex-start' }}
      >
        <Ladder states={states} width={180} />
        <p className="q" style={{ flex: 1 }} aria-live="polite">
          {question.prompt}
        </p>
      </div>
      <div className="hide-desk" style={{ marginTop: 16 }}>
        <div className="strip" aria-hidden="true">
          {states.map((s, i) => (
            <i key={i} className={s}>
              {i + 1}
            </i>
          ))}
        </div>
        <p className="q mt20" aria-live="polite">
          {question.prompt}
        </p>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
      >
        <label className="sr-only" htmlFor="daily-answer">
          Your answer
        </label>
        <textarea
          id="daily-answer"
          ref={input}
          className={`field area on-surface mt26${warning ? ' error' : ''}`}
          style={{ minHeight: 104 }}
          value={answer}
          maxLength={MAX_ANSWER_LENGTH}
          placeholder="Your answer"
          disabled={grading}
          onChange={(e) => {
            setAnswer(e.target.value);
            setRejected(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit(false);
            }
          }}
          aria-invalid={warning ? true : undefined}
          aria-describedby={warning ? 'daily-warn' : undefined}
        />
        {warning ? (
          <p className="warn mt8" id="daily-warn" role="alert">
            <TriangleAlert aria-hidden="true" />
            <span>{warning}</span>
          </p>
        ) : null}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <button
            type="button"
            className="btn btn-quiet"
            style={{ flex: 1 }}
            disabled={grading}
            onClick={() => void submit(true)}
          >
            I don&apos;t know
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ flex: 2 }}
            disabled={grading || !answer.trim() || !!warning}
          >
            {grading ? 'Checking…' : 'Submit'}
          </button>
        </div>
      </form>
    </div>
  );
}
