/**
 * The mix-up drill ("Drill this pair", review.png). Both scripts' "Tell it
 * apart" questions, taking turns, up to two from each. Like the ladder it ends
 * on the first miss; the score is how many were answered. Drills never count
 * toward best rung, rank, rounds or mastery.
 */
import { makeAttempt, type LadderStatus, type SubmittedAnswer } from '../ladder/engine.ts';
import { PERSONAS, type PersonaId } from '../ladder/personas.ts';
import type { Attempt } from '../schemas/attempt.ts';
import type { Question } from '../schemas/question.ts';

export const DRILL_PER_SCRIPT = 2;

export class DrillError extends Error {
  override name = 'DrillError';
}

export interface DrillState {
  /** [left, right]: the order the pair is shown in Review. */
  readonly script_ids: readonly [string, string];
  readonly persona: PersonaId;
  /** Over this, a right answer is tagged `slow`. The persona's, unless Settings overrides it. */
  readonly time_limit_ms: number | null;
  readonly questions: readonly Question[];
  readonly index: number;
  readonly attempts: readonly Attempt[];
  readonly status: LadderStatus;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  // Decorate-sort: a random key per item, no index juggling.
  return items
    .map((item) => ({ item, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

/**
 * Picks the drill's questions: each script's differentiate questions in a
 * random order, up to two each, alternating left, right, left, right.
 */
export function pickDrill(
  left: readonly Question[],
  right: readonly Question[],
  options: { random?: () => number; perScript?: number } = {},
): Question[] {
  const random = options.random ?? Math.random;
  const per = options.perScript ?? DRILL_PER_SCRIPT;
  const a = shuffled(
    left.filter((q) => q.rung === 'differentiate'),
    random,
  ).slice(0, per);
  const b = shuffled(
    right.filter((q) => q.rung === 'differentiate'),
    random,
  ).slice(0, per);
  const out: Question[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const fromLeft = a[i];
    const fromRight = b[i];
    if (fromLeft) out.push(fromLeft);
    if (fromRight) out.push(fromRight);
  }
  return out;
}

export function startDrill(
  scriptIds: readonly [string, string],
  questions: readonly Question[],
  persona: PersonaId,
  options: { time_limit_ms?: number | null } = {},
): DrillState {
  if (questions.length === 0) throw new DrillError('A drill needs at least one question');
  if (questions.some((q) => !scriptIds.includes(q.script_id))) {
    throw new DrillError('Drill questions must come from the pair');
  }
  return {
    script_ids: scriptIds,
    persona,
    time_limit_ms:
      options.time_limit_ms !== undefined ? options.time_limit_ms : PERSONAS[persona].time_limit_ms,
    questions,
    index: 0,
    attempts: [],
    status: 'in_progress',
  };
}

export function drillQuestion(state: DrillState): Question | null {
  if (state.status !== 'in_progress') return null;
  return state.questions[state.index] ?? null;
}

/** Records an answer; the drill ends on the first miss or after the last question. */
export function submitDrillAnswer(state: DrillState, submitted: SubmittedAnswer): DrillState {
  const question = drillQuestion(state);
  if (!question) throw new DrillError(`Drill is ${state.status}; no question to answer`);
  const attempt = makeAttempt(question, state.time_limit_ms, submitted);
  const next = state.index + 1;
  const status: LadderStatus = !attempt.passed
    ? 'missed'
    : next >= state.questions.length
      ? 'completed'
      : 'in_progress';
  return { ...state, index: next, attempts: [...state.attempts, attempt], status };
}

/**
 * The time limit ran out before an answer was sent: the drill ends on a
 * `slow` miss, with nothing graded. Only for a timed drill (like `timeUp`).
 */
export function drillTimeUp(state: DrillState): DrillState {
  const question = drillQuestion(state);
  if (!question) throw new DrillError(`Drill is ${state.status}; no question to answer`);
  if (state.time_limit_ms === null) throw new DrillError('An untimed drill cannot run out of time');
  const attempt: Attempt = {
    question_id: question.id,
    answer: '',
    elapsed_ms: state.time_limit_ms,
    grade: 'incorrect',
    reason: 'Time ran out',
    credit: 0,
    passed: false,
    miss_tag: 'slow',
    matched: [],
    grader: 'local',
    grader_version: null,
  };
  return {
    ...state,
    index: state.index + 1,
    attempts: [...state.attempts, attempt],
    status: 'missed',
  };
}

/** Questions answered before the miss (or all of them). */
export function drillScore(state: DrillState): number {
  return state.attempts.filter((a) => a.passed).length;
}
