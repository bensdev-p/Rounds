/**
 * The miss card (docs/PRODUCT.md → Planned: the miss card). It explains the
 * miss that ended a session in one sentence: the student's own words, then what
 * the approved script says. The correction comes only from the script fields
 * the question was built on (domain rule 1); nothing here is generated.
 */
import type { Confusable } from '../grading/localGrader.ts';
import { PERSONAS, type PersonaId } from '../ladder/personas.ts';
import type { GradeResult, MissTag } from '../schemas/attempt.ts';
import { collectStrings, resolveFieldPath } from '../schemas/fieldPath.ts';
import type { IllnessScript } from '../schemas/illnessScript.ts';
import type { Question, Rung } from '../schemas/question.ts';

/** Rung names as shown on the ladder. */
export const RUNG_LABELS: Record<Rung, string> = {
  recall: 'Recall',
  second_order: 'Next most common',
  differentiate: 'Tell it apart',
  workup: 'Workup',
  management: 'Management',
  pearl: 'Pearl',
};

export interface MissCard {
  /** "Missed on management" */
  label: string;
  /** The student's answer, to quote; null when they gave none. */
  quote: string | null;
  /** Plain text after the quote, from the script. */
  correction: string;
  script_id: string;
}

const MAX_QUOTE = 120;

function quoteOf(answer: string): string | null {
  const trimmed = answer.trim().replace(/\s+/g, ' ');
  if (!trimmed) return null;
  return trimmed.length > MAX_QUOTE ? `${trimmed.slice(0, MAX_QUOTE - 1).trimEnd()}…` : trimmed;
}

function sentence(text: string): string {
  const t = text.trim();
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** What the script says for this question: the text of its source fields. */
export function scriptSays(question: Question, script: IllnessScript): string {
  return question.source_fields
    .flatMap((path) => collectStrings(resolveFieldPath(script, path)))
    .join('; ');
}

export function buildMissCard(input: {
  /** The answer that ended the session. Already passed the PHI check. */
  answer: string;
  result: GradeResult;
  missTag: MissTag | null;
  question: Question;
  script: IllnessScript;
  confusables: readonly Confusable[];
  persona: PersonaId;
}): MissCard {
  const { answer, result, missTag, question, script, confusables, persona } = input;
  const label = `Missed on ${RUNG_LABELS[question.rung].toLowerCase()}`;

  let correction: string;
  if (missTag === 'slow') {
    const { label: who, time_limit_ms } = PERSONAS[persona];
    correction =
      time_limit_ms === null
        ? 'Right answer, but too slow.'
        : `Right answer, but the ${who} wanted it inside ${Math.round(time_limit_ms / 1000)} seconds.`;
  } else if (question.kind === 'list') {
    const named = new Set(result.matched);
    const missed = question.accepted_answers.map((a) => a.answer).filter((a) => !named.has(a));
    correction = `You named ${named.size} of the ${question.required_count} needed. The script also lists ${missed.join(', ')}.`;
  } else if (missTag?.startsWith('confused_with:')) {
    const otherId = missTag.slice('confused_with:'.length);
    const other = confusables.find((c) => c.script_id === otherId)?.names[0] ?? otherId;
    const link = script.confused_with.find((c) => c.script_id === otherId);
    correction = [
      `That fits ${other}.`,
      link ? sentence(link.how_to_tell_apart) : '',
      `The script says: ${sentence(scriptSays(question, script))}`,
    ]
      .filter(Boolean)
      .join(' ');
  } else {
    correction = `The script says: ${sentence(scriptSays(question, script))}`;
  }

  return { label, quote: quoteOf(answer), correction, script_id: script.id };
}
