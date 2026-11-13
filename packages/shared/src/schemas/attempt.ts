import { z } from 'zod';
import { detectPhi } from '../phi/detectPhi.ts';
import { ScriptIdSchema } from './illnessScript.ts';
import { QuestionIdSchema } from './question.ts';

export const GRADES = ['correct', 'partial', 'incorrect'] as const;
export const GradeSchema = z.enum(GRADES);
export type Grade = z.infer<typeof GradeSchema>;

/** What a grader (local matcher or LLM) returns. Never facts from outside the script. */
export const GradeResultSchema = z.strictObject({
  grade: GradeSchema,
  /** One line, shown to the student. */
  reason: z.string().trim().min(1).max(200),
  /** Canonical accepted answers the student hit (list questions: the ones found). */
  matched: z.array(z.string()),
  /** Set when the answer matched a script from `confused_with` instead. */
  confused_with_script_id: ScriptIdSchema.nullable(),
});
export type GradeResult = z.infer<typeof GradeResultSchema>;

/** Who graded an attempt: the deterministic matcher or the LLM. */
export const GraderSchema = z.enum(['local', 'llm']);
export type Grader = z.infer<typeof GraderSchema>;

/** e.g. `grade-answer/v1@claude-opus-5-5`. Null for the local grader. */
export const GraderVersionSchema = z.string().min(1).max(100).nullable();

/** Response body of the `grade-answer` Edge Function. */
export const GradeResponseSchema = z.strictObject({
  result: GradeResultSchema,
  grader: GraderSchema,
  grader_version: GraderVersionSchema,
});
export type GradeResponse = z.infer<typeof GradeResponseSchema>;

const CONFUSED_WITH_RE = /^confused_with:[a-z0-9]+(?:-[a-z0-9]+)*$/;
export type ConfusedWithTag = `confused_with:${string}`;
export type MissTag = 'unknown' | 'slow' | 'partial_list' | ConfusedWithTag;

export const MissTagSchema = z.union([
  z.enum(['unknown', 'slow', 'partial_list']),
  z.custom<ConfusedWithTag>(
    (v) => typeof v === 'string' && CONFUSED_WITH_RE.test(v),
    'Expected confused_with:<script_id>',
  ),
]);

export function confusedWithTag(scriptId: string): ConfusedWithTag {
  return `confused_with:${scriptId}`;
}

export const MAX_ANSWER_LENGTH = 500;

/** Free-text answer. Blocks anything resembling patient identifiers. */
export const AnswerTextSchema = z
  .string()
  .max(MAX_ANSWER_LENGTH)
  .refine((text) => !detectPhi(text).blocked, {
    message: 'Answer looks like it contains patient details',
  });

export const AttemptSchema = z.strictObject({
  question_id: QuestionIdSchema,
  answer: AnswerTextSchema,
  elapsed_ms: z.number().int().nonnegative(),
  grade: GradeSchema,
  reason: z.string().max(200),
  /** 0–1. List questions: found / required (capped at 1). Single: 1 or 0. */
  credit: z.number().min(0).max(1),
  passed: z.boolean(),
  miss_tag: MissTagSchema.nullable(),
  grader: GraderSchema,
  grader_version: GraderVersionSchema,
});
export type Attempt = z.infer<typeof AttemptSchema>;
