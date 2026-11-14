/**
 * The patient log (wireframe 08): a diagnosis label, the rotation and when it
 * was logged. Nothing that could hold patient details (domain rule 5).
 */
import { z } from 'zod';
import { detectPhi } from '../phi/detectPhi.ts';
import { RotationSchema, ScriptIdSchema } from './illnessScript.ts';

export const MAX_LOG_LABEL_LENGTH = 80;

/**
 * A label as typed or picked. Checked with the patient log's guard (names,
 * dates and digit runs too) before it leaves the device.
 */
export const LogLabelSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_LOG_LABEL_LENGTH)
  .refine((text) => !detectPhi(text, { checkNames: true, diagnosisOnly: true }).blocked, {
    message: 'Label looks like it contains patient details',
  });

export const NewPatientLogSchema = z.strictObject({
  label: LogLabelSchema,
  /** Null when no script matches. The log is still saved. */
  script_id: ScriptIdSchema.nullable(),
  rotation: RotationSchema,
});
export type NewPatientLog = z.infer<typeof NewPatientLogSchema>;

export const PatientLogSchema = z.strictObject({
  id: z.uuid(),
  label: z.string().min(1).max(MAX_LOG_LABEL_LENGTH),
  script_id: ScriptIdSchema.nullable(),
  rotation: RotationSchema,
  /** ISO timestamp. */
  logged_at: z.iso.datetime({ offset: true }),
});
export type PatientLog = z.infer<typeof PatientLogSchema>;
