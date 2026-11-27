/**
 * The session header's clock. With a time limit (the Internist, the Surgeon,
 * or a Settings override) it counts down per question and 0:00 ends the run
 * on a `slow` miss (`timeUp`). Untimed (the Teacher), it counts up from the
 * first question, as a plain session clock.
 */
import type { GradeResult } from '../schemas/attempt.ts';

export interface ClockReading {
  mode: 'countdown' | 'elapsed';
  /** Time left (countdown) or time since the first question (elapsed). */
  ms: number;
  /** "0:30", "1:05". */
  text: string;
  /** Countdown only: the question's time has run out. */
  timeUp: boolean;
}

/**
 * Formats a clock as m:ss. A countdown rounds up, so a fresh question reads
 * 0:30 and only an expired one reads 0:00; elapsed time rounds down.
 */
export function formatClock(ms: number, mode: ClockReading['mode'] = 'elapsed'): string {
  const seconds = Math.max(0, mode === 'countdown' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

export function readClock(input: {
  time_limit_ms: number | null;
  /** Answering time on the current question (excludes grading and the attending asking). */
  question_ms: number;
  /** Since the first question, for the untimed clock. */
  session_ms: number;
}): ClockReading {
  if (input.time_limit_ms === null) {
    const ms = Math.max(0, input.session_ms);
    return { mode: 'elapsed', ms, text: formatClock(ms, 'elapsed'), timeUp: false };
  }
  const ms = Math.max(0, input.time_limit_ms - input.question_ms);
  return { mode: 'countdown', ms, text: formatClock(ms, 'countdown'), timeUp: ms === 0 };
}

/** What a timed-out question was "graded": nothing was sent. For the miss card. */
export const TIME_UP_RESULT: GradeResult = {
  grade: 'incorrect',
  reason: 'Time ran out',
  matched: [],
  confused_with_script_id: null,
};
