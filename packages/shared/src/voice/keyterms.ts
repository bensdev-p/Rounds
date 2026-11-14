/**
 * Expected words for speech-to-text (M2.4: they took Nova-3 from 32/38 to
 * 38/38 on the hard terms): the question's accepted answers and synonyms,
 * straight from the script (domain rule 1).
 */
import type { Question } from '../schemas/question.ts';

/** Keeps each streaming request small, well inside Deepgram's limits. */
export const MAX_KEYTERMS = 50;
export const MAX_KEYTERM_LENGTH = 60;

export function keytermsFor(question: Pick<Question, 'accepted_answers'>): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const accepted of question.accepted_answers) {
    for (const raw of [accepted.answer, ...accepted.synonyms]) {
      const term = raw.trim().replace(/\s+/g, ' ');
      const key = term.toLowerCase();
      if (!term || term.length > MAX_KEYTERM_LENGTH || seen.has(key)) continue;
      seen.add(key);
      terms.push(term);
      if (terms.length === MAX_KEYTERMS) return terms;
    }
  }
  return terms;
}
