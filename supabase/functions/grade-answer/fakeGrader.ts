/**
 * Stand-in for the model in local tests (LLM_PROVIDER=fake). It reads the
 * prompt the real model would get and fuzzy-matches the answer, so the whole
 * request path runs without spending API credit. Answers containing these
 * markers exercise failure paths:
 *   fake-timeout  -> the model call times out
 *   fake-refusal  -> the model refuses
 *   fake-invent   -> the model returns matches that aren't in the script
 */
import { normalize, type GradingContext } from '@rounds/shared';
import { createFakeProvider } from '../_shared/llm/fake.ts';
import type { LlmProvider } from '../_shared/llm/types.ts';

function between(text: string, open: string, close: string): string {
  const start = text.indexOf(open);
  const end = text.lastIndexOf(close);
  return start >= 0 && end > start ? text.slice(start + open.length, end).trim() : '';
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length]!;
}

/** True if some run of words in `answer` is a near-typo of `term` (short terms must be exact). */
function fuzzyHas(answer: string, term: string): boolean {
  const words = normalize(answer).split(' ');
  const target = normalize(term);
  const size = target.split(' ').length;
  const allowed = target.length <= 3 ? 0 : target.length <= 6 ? 1 : 2;
  for (let i = 0; i + size <= words.length; i++) {
    if (editDistance(words.slice(i, i + size).join(' '), target) <= allowed) return true;
  }
  return false;
}

export function createFakeGrader(): LlmProvider {
  return createFakeProvider((request) => {
    const answer = between(request.user, '<student_answer>', '</student_answer>');
    if (answer.includes('fake-timeout')) return { ok: false, reason: 'timeout', detail: 'fake' };
    if (answer.includes('fake-refusal')) return { ok: false, reason: 'refusal', detail: 'fake' };
    if (answer.includes('fake-invent')) {
      return {
        ok: true,
        model: 'fake',
        usage: null,
        value: { matched_answers: ['penicillin'], confused_with_script_id: 'influenza' },
      };
    }

    const context = JSON.parse(
      between(request.user, '<grading_context>', '</grading_context>'),
    ) as GradingContext;
    const matched = context.accepted_answers
      .filter((a) => [a.answer, ...a.synonyms].some((term) => fuzzyHas(answer, term)))
      .map((a) => a.answer);
    const confused =
      matched.length === 0
        ? (context.confusables.find((c) => c.names.some((n) => fuzzyHas(answer, n)))?.script_id ??
          null)
        : null;
    return {
      ok: true,
      model: 'fake',
      usage: null,
      value: { matched_answers: matched, confused_with_script_id: confused },
    };
  });
}
