import type { ListQuestion } from '../schemas/question';

/** A list answer passes the rung at or above this share of `required_count`. */
export const LIST_PASS_THRESHOLD = 0.6;

export interface ListCredit {
  /** Canonical accepted answers the student named. */
  found: string[];
  /** Canonical accepted answers the student did not name (all of them, to show afterward). */
  missed: string[];
  required: number;
  /** found / required, capped at 1. */
  ratio: number;
  passed: boolean;
}

export function listCredit(question: ListQuestion, found: readonly string[]): ListCredit {
  const canonical = question.accepted_answers.map((a) => a.answer);
  const foundSet = new Set(found.filter((f) => canonical.includes(f)));
  const ratio = Math.min(foundSet.size / question.required_count, 1);
  return {
    found: canonical.filter((a) => foundSet.has(a)),
    missed: canonical.filter((a) => !foundSet.has(a)),
    required: question.required_count,
    ratio,
    passed: ratio >= LIST_PASS_THRESHOLD,
  };
}
