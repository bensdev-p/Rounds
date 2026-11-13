import { listCredit } from '../grading/listCredit.ts';
import { confusedWithTag, type GradeResult, type MissTag } from '../schemas/attempt.ts';
import type { Question } from '../schemas/question.ts';

export interface MissInput {
  question: Question;
  result: GradeResult;
  elapsed_ms: number;
  time_limit_ms: number | null;
}

/** Whether the content of the answer was good enough to clear the rung, ignoring time. */
export function contentPassed(question: Question, result: GradeResult): boolean {
  if (question.kind === 'single') return result.grade === 'correct';
  return listCredit(question, result.matched).passed;
}

/** 0–1 credit for an answer: list questions earn partial credit, single questions don't. */
export function answerCredit(question: Question, result: GradeResult): number {
  if (question.kind === 'single') return result.grade === 'correct' ? 1 : 0;
  return listCredit(question, result.matched).ratio;
}

/**
 * Tags a miss automatically (domain rule 4). Returns null when the answer passes.
 *
 * Precedence: a content miss says what to study, so it wins over timing.
 *   confused_with:<id>  answered with a confusable script
 *   partial_list        named some, but below the pass threshold
 *   unknown             anything else wrong
 *   slow                right, but over the persona's time limit
 */
export function classifyMiss({
  question,
  result,
  elapsed_ms,
  time_limit_ms,
}: MissInput): MissTag | null {
  if (contentPassed(question, result)) {
    return time_limit_ms !== null && elapsed_ms > time_limit_ms ? 'slow' : null;
  }
  if (result.confused_with_script_id) return confusedWithTag(result.confused_with_script_id);
  if (question.kind === 'list' && result.matched.length > 0) return 'partial_list';
  return 'unknown';
}
