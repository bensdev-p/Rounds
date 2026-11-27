import { readClock, type ClockReading } from '@rounds/shared';
import { useEffect, useState } from 'react';

interface QuestionTime {
  key: string;
  /** Answering time banked while the clock was held. */
  base: number;
  /** When the clock last started running; null while held. */
  since: number | null;
}

interface SessionTime {
  key: string | number;
  start: number;
  stop: number | null;
}

/**
 * The live session's clock (DESIGN.md → The session, start to finish).
 * With a time limit it counts down per question: it starts again from the
 * limit on each new question, runs only while `running` (not while the
 * attending is asking or an answer is being graded) and reads 0:00 when the
 * time is up. Untimed, it counts up from the first question until `ended`.
 */
export function useQuestionClock({
  timeLimitMs,
  runKey,
  questionKey,
  running,
  ended,
}: {
  timeLimitMs: number | null;
  /** Changes on "Go again": the untimed clock starts over. */
  runKey: string | number;
  /** Changes on each new question: the countdown starts over. */
  questionKey: string;
  /** Whether answering time is counting now. */
  running: boolean;
  /** The ladder is over: the untimed clock stops. */
  ended: boolean;
}): ClockReading & { answerMs: () => number } {
  const [now, setNow] = useState(() => Date.now());
  const [question, setQuestion] = useState<QuestionTime>(() => ({
    key: questionKey,
    base: 0,
    since: running ? Date.now() : null,
  }));
  const [session, setSession] = useState<SessionTime>(() => ({
    key: runKey,
    start: Date.now(),
    stop: null,
  }));

  // Follow the inputs during render (React's "adjusting state when a prop
  // changes"), so a new question never shows the last one's time.
  const [seen, setSeen] = useState({ questionKey, running, runKey, ended });
  if (
    seen.questionKey !== questionKey ||
    seen.running !== running ||
    seen.runKey !== runKey ||
    seen.ended !== ended
  ) {
    setSeen({ questionKey, running, runKey, ended });
    setQuestion((q) => {
      const t = Date.now();
      if (q.key !== questionKey) return { key: questionKey, base: 0, since: running ? t : null };
      if (running && q.since === null) return { ...q, since: t };
      if (!running && q.since !== null) return { ...q, base: q.base + (t - q.since), since: null };
      return q;
    });
    setSession((s) => {
      const t = Date.now();
      if (s.key !== runKey) return { key: runKey, start: t, stop: null };
      if (ended && s.stop === null) return { ...s, stop: t };
      return s;
    });
    setNow(() => Date.now());
  }

  const ticking = timeLimitMs === null ? !ended : running;
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [ticking]);

  const fresh = question.key !== questionKey;
  const reading = readClock({
    time_limit_ms: timeLimitMs,
    question_ms: fresh
      ? 0
      : question.base + (question.since === null ? 0 : Math.max(0, now - question.since)),
    session_ms: session.key !== runKey ? 0 : (session.stop ?? now) - session.start,
  });

  /** Answering time on the current question so far, for the attempt's `elapsed_ms`. */
  const answerMs = () =>
    fresh ? 0 : question.base + (question.since === null ? 0 : Date.now() - question.since);

  return { ...reading, answerMs };
}
