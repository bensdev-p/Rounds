import type { GradeResult } from '../schemas/attempt.ts';
import type { IllnessScript } from '../schemas/illnessScript.ts';
import type { AcceptedAnswer, Question } from '../schemas/question.ts';
import { containsTerm } from '../text.ts';
import { listCredit } from './listCredit.ts';

/** A script the student might mistake this one for: its id plus the names it goes by. */
export interface Confusable {
  script_id: string;
  names: readonly string[];
}

/** Resolves a script's `confused_with` links to the names those scripts go by. */
export function confusablesFor(
  script: Pick<IllnessScript, 'confused_with'>,
  scripts: readonly Pick<IllnessScript, 'id' | 'name' | 'aliases'>[],
): Confusable[] {
  return script.confused_with.flatMap((link) => {
    const other = scripts.find((s) => s.id === link.script_id);
    return other ? [{ script_id: other.id, names: [other.name, ...other.aliases] }] : [];
  });
}

function hits(text: string, accepted: AcceptedAnswer): boolean {
  return [accepted.answer, ...accepted.synonyms].some((term) => containsTerm(text, term));
}

/** Splits a list answer on commas, semicolons, newlines and "and"/"or". */
export function splitListAnswer(answer: string): string[] {
  return answer
    .split(/[,;\n]|\band\b|\bor\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function findConfusable(answer: string, confusables: readonly Confusable[]): string | null {
  for (const c of confusables) {
    if (c.names.some((name) => containsTerm(answer, name))) return c.script_id;
  }
  return null;
}

/**
 * Deterministic grader: matches the answer against the question's accepted
 * answers and synonyms. Used as the test oracle and the offline fallback for
 * the LLM grader. It cannot judge reasoning or catch negation ("not X").
 */
export function gradeLocally(
  question: Question,
  answer: string,
  confusables: readonly Confusable[] = [],
): GradeResult {
  const found =
    question.kind === 'single'
      ? question.accepted_answers.filter((a) => hits(answer, a)).map((a) => a.answer)
      : question.accepted_answers
          .filter((a) => splitListAnswer(answer).some((item) => hits(item, a)))
          .map((a) => a.answer);
  return gradeFromMatches(question, found, findConfusable(answer, confusables));
}

/**
 * Builds the grade from which canonical accepted answers the student named.
 * Shared by the local and LLM graders so both score and word results the same
 * way. `confusedWith` only counts when nothing correct was named.
 */
export function gradeFromMatches(
  question: Question,
  found: readonly string[],
  confusedWith: string | null,
): GradeResult {
  if (question.kind === 'single') {
    const canonical = question.accepted_answers.map((a) => a.answer);
    const matched = canonical.filter((a) => found.includes(a));
    if (matched.length > 0) {
      return { grade: 'correct', reason: 'Correct.', matched, confused_with_script_id: null };
    }
    const expected = canonical[0] ?? '';
    return {
      grade: 'incorrect',
      reason: confusedWith
        ? `That describes a different condition. Expected: ${expected}.`
        : `Expected: ${expected}.`,
      matched: [],
      confused_with_script_id: confusedWith,
    };
  }

  const credit = listCredit(question, found);
  const count = credit.found.length;
  const grade = count >= question.required_count ? 'correct' : count > 0 ? 'partial' : 'incorrect';
  const reason =
    grade === 'correct'
      ? `Named ${count} of ${question.required_count}.`
      : `Named ${count} of ${question.required_count}. Missed: ${credit.missed.join(', ')}.`;
  return {
    grade,
    reason: reason.length > 200 ? `${reason.slice(0, 197)}...` : reason,
    matched: credit.found,
    confused_with_script_id: count === 0 ? confusedWith : null,
  };
}
