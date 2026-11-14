import type { Attempt, GradeResult, Grader } from '../schemas/attempt.ts';
import { RUNGS, rungIndex, type Question, type Rung } from '../schemas/question.ts';
import { answerCredit, classifyMiss } from './missTags.ts';
import { DEFAULT_PERSONA, PERSONAS, type PersonaId } from './personas.ts';

export type LadderStatus = 'in_progress' | 'missed' | 'completed';

export interface LadderState {
  readonly script_id: string;
  readonly persona: PersonaId;
  /** Sorted by rung, lowest first. */
  readonly questions: readonly Question[];
  readonly index: number;
  readonly attempts: readonly Attempt[];
  readonly status: LadderStatus;
}

export interface SubmittedAnswer {
  answer: string;
  elapsed_ms: number;
  result: GradeResult;
  /** Defaults to the local grader. */
  grader?: Grader;
  grader_version?: string | null;
}

export class LadderError extends Error {
  override name = 'LadderError';
}

/**
 * Picks one question per rung for a session. A script may hold 2–3 questions
 * per rung so repeat sessions differ; questions in `avoid` (usually the ones
 * asked last session) are skipped when the rung has another option.
 * Returns the picks sorted by rung, ready for `startLadder`.
 */
export function pickLadder(
  questions: readonly Question[],
  options: { avoid?: Iterable<string>; random?: () => number } = {},
): Question[] {
  const avoid = new Set(options.avoid ?? []);
  const random = options.random ?? Math.random;
  const picks: Question[] = [];
  for (const rung of RUNGS) {
    const onRung = questions.filter((q) => q.rung === rung);
    if (onRung.length === 0) continue;
    const fresh = onRung.filter((q) => !avoid.has(q.id));
    const pool = fresh.length > 0 ? fresh : onRung;
    // `random()` is in [0, 1); the clamp guards a test stub that returns 1.
    const pick = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    if (pick) picks.push(pick);
  }
  return picks;
}

export function startLadder(
  questions: readonly Question[],
  persona: PersonaId = DEFAULT_PERSONA,
): LadderState {
  const first = questions[0];
  if (!first) throw new LadderError('A ladder needs at least one question');
  if (questions.some((q) => q.script_id !== first.script_id)) {
    throw new LadderError('All questions in a ladder must come from the same script');
  }
  if (new Set(questions.map((q) => q.rung)).size !== questions.length) {
    throw new LadderError('A ladder asks one question per rung; use pickLadder first');
  }
  const sorted = [...questions].sort((a, b) => rungIndex(a.rung) - rungIndex(b.rung));
  return {
    script_id: first.script_id,
    persona,
    questions: sorted,
    index: 0,
    attempts: [],
    status: 'in_progress',
  };
}

export function currentQuestion(state: LadderState): Question | null {
  if (state.status !== 'in_progress') return null;
  return state.questions[state.index] ?? null;
}

/** Records an answer and advances the ladder. The ladder ends on the first miss. */
export function submitAnswer(state: LadderState, submitted: SubmittedAnswer): LadderState {
  const question = currentQuestion(state);
  if (!question) throw new LadderError(`Ladder is ${state.status}; no question to answer`);

  const miss_tag = classifyMiss({
    question,
    result: submitted.result,
    elapsed_ms: submitted.elapsed_ms,
    time_limit_ms: PERSONAS[state.persona].time_limit_ms,
  });
  const passed = miss_tag === null;

  const attempt: Attempt = {
    question_id: question.id,
    answer: submitted.answer,
    elapsed_ms: submitted.elapsed_ms,
    grade: submitted.result.grade,
    reason: submitted.result.reason,
    credit: answerCredit(question, submitted.result),
    passed,
    miss_tag,
    grader: submitted.grader ?? 'local',
    grader_version: submitted.grader_version ?? null,
  };

  const nextIndex = state.index + 1;
  const status: LadderStatus = !passed
    ? 'missed'
    : nextIndex >= state.questions.length
      ? 'completed'
      : 'in_progress';

  return { ...state, index: nextIndex, attempts: [...state.attempts, attempt], status };
}

/** Rungs whose question was passed, in ladder order. */
export function clearedRungs(state: LadderState): Rung[] {
  const passedIds = new Set(state.attempts.filter((a) => a.passed).map((a) => a.question_id));
  return RUNGS.filter((rung) => {
    const onRung = state.questions.filter((q) => q.rung === rung);
    return onRung.length > 0 && onRung.every((q) => passedIds.has(q.id));
  });
}

/** Score = number of rungs cleared (0–6). */
export function ladderScore(state: LadderState): number {
  return clearedRungs(state).length;
}

/** The miss that ended the ladder, if it ended on one. */
export function endingMiss(state: LadderState): Attempt | null {
  if (state.status !== 'missed') return null;
  return state.attempts.at(-1) ?? null;
}

export function bestRung(previousBest: number | null, score: number): number {
  return Math.max(previousBest ?? 0, score);
}
