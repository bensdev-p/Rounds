/**
 * "This is wrong" flags: a student reports that a question or a whole script
 * is wrong. They feed the content review queue (`pnpm content:flags`).
 */
import { z } from 'zod';
import { detectPhi } from '../phi/detectPhi.ts';
import { ScriptIdSchema } from './illnessScript.ts';
import { QuestionIdSchema } from './question.ts';

export const FLAG_REASONS = ['marked_wrong', 'unclear', 'script_error', 'other'] as const;
export const FlagReasonSchema = z.enum(FLAG_REASONS);
export type FlagReason = z.infer<typeof FlagReasonSchema>;

/** As the student sees them. */
export const FLAG_REASON_LABELS: Record<FlagReason, string> = {
  marked_wrong: 'My answer was right but marked wrong',
  unclear: 'The question is unclear',
  script_error: 'The script has a mistake',
  other: 'Something else',
};

export const MAX_FLAG_NOTE_LENGTH = 280;

/**
 * Optional free-text note. Checked for patient details with name detection on:
 * a note is about content, so "Mr. Alvarez" has no business in it (domain rule 5).
 */
export const FlagNoteSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_FLAG_NOTE_LENGTH)
  .refine((text) => !detectPhi(text, { checkNames: true }).blocked, {
    message: 'Note looks like it contains patient details',
  });

export const NewFlagSchema = z.strictObject({
  script_id: ScriptIdSchema,
  /** Null when the whole script is flagged. */
  question_id: QuestionIdSchema.nullable(),
  script_version: z.number().int().positive(),
  reason: FlagReasonSchema,
  note: FlagNoteSchema.nullable(),
});
export type NewFlag = z.infer<typeof NewFlagSchema>;
