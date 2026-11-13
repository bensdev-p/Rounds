import type { GradeResult } from '../schemas/attempt';
import type { IllnessScript } from '../schemas/illnessScript';
import type { AcceptedAnswer, Question } from '../schemas/question';
import { containsTerm } from '../text';
import { listCredit } from './listCredit';

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
  if (question.kind === 'single') {
    const matched = question.accepted_answers.filter((a) => hits(answer, a)).map((a) => a.answer);
    if (matched.length > 0) {
      return { grade: 'correct', reason: 'Correct.', matched, confused_with_script_id: null };
    }
    const confused = findConfusable(answer, confusables);
    const expected = question.accepted_answers[0]?.answer ?? '';
    return {
      grade: 'incorrect',
      reason: confused
        ? `That describes a different condition. Expected: ${expected}.`
        : `Expected: ${expected}.`,
      matched: [],
      confused_with_script_id: confused,
    };
  }

  const items = splitListAnswer(answer);
  const found = question.accepted_answers
    .filter((a) => items.some((item) => hits(item, a)))
    .map((a) => a.answer);
  const credit = listCredit(question, found);
  const grade =
    found.length >= question.required_count
      ? 'correct'
      : found.length > 0
        ? 'partial'
        : 'incorrect';
  const reason =
    grade === 'correct'
      ? `Named ${found.length} of ${question.required_count}.`
      : `Named ${found.length} of ${question.required_count}. Missed: ${credit.missed.join(', ')}.`;
  return {
    grade,
    reason: reason.length > 200 ? `${reason.slice(0, 197)}...` : reason,
    matched: credit.found,
    confused_with_script_id: found.length === 0 ? findConfusable(answer, confusables) : null,
  };
}
