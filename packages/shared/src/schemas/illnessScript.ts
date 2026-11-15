import { z } from 'zod';
import { FieldPathSchema, resolveFieldPath } from './fieldPath.ts';
import { RungSchema } from './rung.ts';

export const ROTATIONS = ['IM', 'surgery', 'peds', 'obgyn', 'psych', 'neuro', 'FM', 'EM'] as const;
export const RotationSchema = z.enum(ROTATIONS);
export type Rotation = z.infer<typeof RotationSchema>;

export const SCRIPT_STATUSES = ['draft', 'in_review', 'approved', 'retired'] as const;
export const ScriptStatusSchema = z.enum(SCRIPT_STATUSES);
export type ScriptStatus = z.infer<typeof ScriptStatusSchema>;

export const DIFFICULTY_LEVELS = ['MS1-2', 'MS3', 'MS4'] as const;
export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];

/** Kebab-case slug, e.g. `diabetic-ketoacidosis`. */
export const ScriptIdSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Script id must be a kebab-case slug')
  .max(80);
export type ScriptId = z.infer<typeof ScriptIdSchema>;

const Text = z.string().trim().min(1);
const TextList = z.array(Text);

/**
 * A link to one AnKing note. IDs only: there is deliberately no field that
 * could hold card text or tag names (CLAUDE.md domain rule 6).
 *
 * Note ids, not card ids: AnkiHub gives every subscriber AnKing's own note ids,
 * while card ids differ per student (M3.1 findings). `rung` says which rung's
 * miss the note answers; a note without one is a core note for the script,
 * used when the missed rung has no notes of its own.
 */
export const AnkiRefSchema = z.strictObject({
  kind: z.literal('note'),
  id: z.string().regex(/^\d{1,20}$/, 'Anki ids are numeric'),
  rung: RungSchema.optional(),
});
export type AnkiRef = z.infer<typeof AnkiRefSchema>;

/** At most this many linked notes per rung ("Unsuspend 3 Anki cards", result.png). */
export const MAX_ANKI_NOTES_PER_RUNG = 3;
/** At most this many core notes (no rung) per script. */
export const MAX_ANKI_CORE_NOTES = 5;

export const SourceSchema = z.strictObject({
  title: Text,
  url: z.url().optional(),
});

/**
 * One row of the mix-up comparison (Review → "You keep mixing these up"): a
 * short label, this script's side in a few words, and the field it comes from
 * (domain rule 1). The other script's link back carries the same labels in the
 * same order, so the two columns line up.
 */
export const CompareRowSchema = z.strictObject({
  label: Text.max(16),
  text: Text.max(36),
  source_field: FieldPathSchema,
});
export type CompareRow = z.infer<typeof CompareRowSchema>;

export const MAX_COMPARE_ROWS = 3;

export const ConfusedWithSchema = z.strictObject({
  script_id: ScriptIdSchema,
  how_to_tell_apart: Text,
  compare: z.array(CompareRowSchema).min(1).max(MAX_COMPARE_ROWS).optional(),
});

/** The clinical content of a script: stored as `content jsonb` in Postgres. */
export const IllnessScriptContentSchema = z.strictObject({
  name: Text,
  aliases: TextList,
  rotation: z.array(RotationSchema).min(1),
  epidemiology: z.strictObject({
    who: Text,
    risk_factors: TextList,
  }),
  pathophysiology: Text,
  timeline: z.strictObject({
    onset: Text,
    course: Text,
  }),
  key_findings: z.strictObject({
    history: TextList,
    exam: TextList,
    labs: TextList,
    imaging: TextList,
  }),
  diagnosis: z.strictObject({
    confirmatory_tests: TextList.min(1),
    criteria: TextList,
  }),
  management: z.strictObject({
    first_line: TextList.min(1),
    next_line: TextList,
  }),
  complications: TextList,
  confused_with: z.array(ConfusedWithSchema),
  pearls: TextList,
  /** Field paths into this script, grouped by the level a fact is expected at. */
  difficulty_tiers: z.strictObject({
    'MS1-2': z.array(FieldPathSchema),
    MS3: z.array(FieldPathSchema),
    MS4: z.array(FieldPathSchema),
  }),
  anki_refs: z.array(AnkiRefSchema),
  sources: z.array(SourceSchema).min(1),
});
export type IllnessScriptContent = z.infer<typeof IllnessScriptContentSchema>;

/** Review metadata: stored as real columns so Postgres can enforce it. */
export const IllnessScriptMetaSchema = z.strictObject({
  id: ScriptIdSchema,
  status: ScriptStatusSchema,
  version: z.number().int().positive(),
  /** Reviewer initials or handle. Text for Stage 1; reviewers have no accounts yet. */
  reviewed_by: Text.max(64).nullable(),
  reviewed_at: z.iso.datetime({ offset: true }).nullable(),
});

export const IllnessScriptSchema = IllnessScriptMetaSchema.extend(
  IllnessScriptContentSchema.shape,
).superRefine((script, ctx) => {
  if (script.status === 'approved' && (!script.reviewed_by || !script.reviewed_at)) {
    ctx.addIssue({
      code: 'custom',
      path: ['reviewed_by'],
      message: 'Approved scripts must record reviewed_by and reviewed_at',
    });
  }

  const seen = new Set<string>();
  script.confused_with.forEach((link, i) => {
    if (link.script_id === script.id) {
      ctx.addIssue({
        code: 'custom',
        path: ['confused_with', i, 'script_id'],
        message: 'A script cannot be confused with itself',
      });
    }
    if (seen.has(link.script_id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['confused_with', i, 'script_id'],
        message: `Duplicate confused_with link to ${link.script_id}`,
      });
    }
    seen.add(link.script_id);
    link.compare?.forEach((row, r) => {
      if (resolveFieldPath(script, row.source_field) === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['confused_with', i, 'compare', r, 'source_field'],
          message: `Field path "${row.source_field}" does not exist in this script`,
        });
      }
    });
  });

  const ankiIds = new Set<string>();
  const perGroup = new Map<string, number>();
  script.anki_refs.forEach((ref, i) => {
    if (ankiIds.has(ref.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['anki_refs', i, 'id'],
        message: `Duplicate Anki note ${ref.id}`,
      });
    }
    ankiIds.add(ref.id);
    const group = ref.rung ?? 'core';
    const count = (perGroup.get(group) ?? 0) + 1;
    perGroup.set(group, count);
    const max = ref.rung ? MAX_ANKI_NOTES_PER_RUNG : MAX_ANKI_CORE_NOTES;
    if (count === max + 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['anki_refs', i],
        message: ref.rung
          ? `More than ${max} Anki notes on the ${ref.rung} rung`
          : `More than ${max} core Anki notes (no rung)`,
      });
    }
  });

  for (const level of DIFFICULTY_LEVELS) {
    script.difficulty_tiers[level].forEach((path, i) => {
      if (resolveFieldPath(script, path) === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: ['difficulty_tiers', level, i],
          message: `Field path "${path}" does not exist in this script`,
        });
      }
    });
  }
});
export type IllnessScript = z.infer<typeof IllnessScriptSchema>;

/** Only approved scripts may be used for pimping (domain rule 2). */
export function isPimpable(script: Pick<IllnessScript, 'status'>): boolean {
  return script.status === 'approved';
}
