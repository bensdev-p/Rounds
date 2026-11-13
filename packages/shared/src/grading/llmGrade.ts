/**
 * Pure helpers for the LLM grader (supabase/functions/grade-answer).
 *
 * The model is only asked which of the question's accepted answers the
 * student expressed, and whether they named a commonly confused condition
 * instead. Everything it returns is checked against the script here, and the
 * grade, credit and wording come from `gradeFromMatches`, so the model never
 * writes medical text the student sees (domain rule 1).
 */
import { z } from 'zod';
import { collectStrings, resolveFieldPath } from '../schemas/fieldPath.ts';
import type { GradeResult } from '../schemas/attempt.ts';
import type { IllnessScript } from '../schemas/illnessScript.ts';
import type { Question } from '../schemas/question.ts';
import { normalize } from '../text.ts';
import { gradeFromMatches, type Confusable } from './localGrader.ts';

/** What the model must return. Flat and small so structured outputs can enforce it. */
export const LlmGradeOutputSchema = z.object({
  /** Canonical accepted answers the student expressed, copied exactly. */
  matched_answers: z.array(z.string()),
  /** A confusable script id the student named instead, or null. */
  confused_with_script_id: z.string().nullable(),
});
export type LlmGradeOutput = z.infer<typeof LlmGradeOutputSchema>;

export interface GradingConfusable {
  script_id: string;
  names: readonly string[];
  how_to_tell_apart: string;
}

/** Everything the model may use to grade, all taken from the approved script. */
export interface GradingContext {
  script_name: string;
  question: string;
  kind: Question['kind'];
  /** List questions only. */
  required_count: number | null;
  accepted_answers: readonly { answer: string; synonyms: readonly string[] }[];
  /** Text of the script fields the question was written from. */
  source_excerpts: readonly string[];
  confusables: readonly GradingConfusable[];
}

export function buildGradingContext(
  question: Question,
  script: IllnessScript,
  confusables: readonly Confusable[],
): GradingContext {
  return {
    script_name: script.name,
    question: question.prompt,
    kind: question.kind,
    required_count: question.kind === 'list' ? question.required_count : null,
    accepted_answers: question.accepted_answers.map((a) => ({
      answer: a.answer,
      synonyms: a.synonyms,
    })),
    source_excerpts: question.source_fields.flatMap((path) =>
      collectStrings(resolveFieldPath(script, path)),
    ),
    confusables: confusables.map((c) => ({
      script_id: c.script_id,
      names: c.names,
      how_to_tell_apart:
        script.confused_with.find((link) => link.script_id === c.script_id)?.how_to_tell_apart ??
        '',
    })),
  };
}

export interface SanitizedGrade {
  result: GradeResult;
  /** Model output that was thrown away because it isn't in the script. For logs. */
  discarded: string[];
}

/**
 * Turns raw model output into a grade that traces to the script:
 * - matches are kept only if they name an accepted answer (or one of its synonyms),
 *   and are mapped to the canonical answer;
 * - a confused-with id is kept only if it is one of the given confusables;
 * - literal matches the local grader already found are never lost;
 * - grade, list credit and reason are recomputed by `gradeFromMatches`.
 */
export function sanitizeLlmGrade(
  raw: LlmGradeOutput,
  question: Question,
  confusables: readonly Confusable[],
  local: GradeResult,
): SanitizedGrade {
  const discarded: string[] = [];
  const canonicalFor = new Map<string, string>();
  for (const accepted of question.accepted_answers) {
    for (const term of [accepted.answer, ...accepted.synonyms]) {
      canonicalFor.set(normalize(term), accepted.answer);
    }
  }

  const found = new Set(local.matched);
  for (const claimed of raw.matched_answers) {
    const canonical = canonicalFor.get(normalize(claimed));
    if (canonical) found.add(canonical);
    else discarded.push(`matched: ${claimed}`);
  }

  let confusedWith: string | null = null;
  if (raw.confused_with_script_id !== null) {
    if (confusables.some((c) => c.script_id === raw.confused_with_script_id)) {
      confusedWith = raw.confused_with_script_id;
    } else {
      discarded.push(`confused_with: ${raw.confused_with_script_id}`);
    }
  }

  return {
    result: gradeFromMatches(question, [...found], confusedWith ?? local.confused_with_script_id),
    discarded,
  };
}
