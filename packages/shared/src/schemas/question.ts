import { z } from 'zod';
import { collectStrings, FieldPathSchema, resolveFieldPath } from './fieldPath.ts';
import { ScriptIdSchema, type IllnessScript } from './illnessScript.ts';
import { containsTerm } from '../text.ts';

/** Ladder rungs, lowest to highest. Order matters: the ladder climbs this list. */
export const RUNGS = [
  'recall',
  'second_order',
  'differentiate',
  'workup',
  'management',
  'pearl',
] as const;
export const RungSchema = z.enum(RUNGS);
export type Rung = z.infer<typeof RungSchema>;

export function rungIndex(rung: Rung): number {
  return RUNGS.indexOf(rung);
}

export const QuestionIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]*$/, 'Question id must be lowercase, e.g. dka.recall.1')
  .max(120);

const Text = z.string().trim().min(1);

export const AcceptedAnswerSchema = z.strictObject({
  answer: Text,
  synonyms: z.array(Text),
});
export type AcceptedAnswer = z.infer<typeof AcceptedAnswerSchema>;

const questionBase = {
  id: QuestionIdSchema,
  script_id: ScriptIdSchema,
  /** The script version this question was reviewed against. */
  script_version: z.number().int().positive(),
  rung: RungSchema,
  prompt: Text,
  /** Where in the script the accepted answers come from. At least one. */
  source_fields: z.array(FieldPathSchema).min(1),
  accepted_answers: z.array(AcceptedAnswerSchema).min(1),
};

export const SingleQuestionSchema = z.strictObject({
  ...questionBase,
  kind: z.literal('single'),
});

export const ListQuestionSchema = z
  .strictObject({
    ...questionBase,
    kind: z.literal('list'),
    /** "Name 5 causes of…" → 5. */
    required_count: z.number().int().positive(),
  })
  .refine((q) => q.required_count <= q.accepted_answers.length, {
    path: ['required_count'],
    message: 'required_count cannot exceed the number of accepted answers',
  });

export const QuestionSchema = z.discriminatedUnion('kind', [
  SingleQuestionSchema,
  ListQuestionSchema,
]);
export type Question = z.infer<typeof QuestionSchema>;
export type SingleQuestion = z.infer<typeof SingleQuestionSchema>;
export type ListQuestion = z.infer<typeof ListQuestionSchema>;

export interface TraceIssue {
  path: string;
  message: string;
}

/**
 * Checks that a question traces to its script (domain rule 1):
 * - it belongs to this script and version,
 * - every source field exists,
 * - every accepted answer appears verbatim (normalized) in a source field.
 *
 * Returns an empty array when the question is fully traceable.
 */
export function traceQuestionToScript(question: Question, script: IllnessScript): TraceIssue[] {
  const issues: TraceIssue[] = [];

  if (question.script_id !== script.id) {
    issues.push({
      path: 'script_id',
      message: `Question belongs to ${question.script_id}, not ${script.id}`,
    });
  }
  if (question.script_version !== script.version) {
    issues.push({
      path: 'script_version',
      message: `Question was reviewed against v${question.script_version}; script is v${script.version}`,
    });
  }

  const sourceText: string[] = [];
  question.source_fields.forEach((path, i) => {
    const value = resolveFieldPath(script, path);
    if (value === undefined) {
      issues.push({
        path: `source_fields[${i}]`,
        message: `"${path}" does not exist in the script`,
      });
    } else {
      sourceText.push(...collectStrings(value));
    }
  });

  question.accepted_answers.forEach((accepted, i) => {
    const traced = sourceText.some((text) => containsTerm(text, accepted.answer));
    if (!traced) {
      issues.push({
        path: `accepted_answers[${i}]`,
        message: `"${accepted.answer}" does not appear in any source field`,
      });
    }
  });

  return issues;
}
