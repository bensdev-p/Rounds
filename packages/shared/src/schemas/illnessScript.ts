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

/**
 * The four kinds of script (domain rule 1, widened 27 Nov 2026). Every
 * question traces to an approved script of one of these kinds. Each kind has
 * its own content fields and its own rung labels (`RUNG_LABELS_BY_KIND`); the
 * six positional rungs, the score and progression are shared.
 */
export const SCRIPT_KINDS = ['disease', 'drug', 'bug', 'pathway'] as const;
export const ScriptKindSchema = z.enum(SCRIPT_KINDS);
export type ScriptKind = z.infer<typeof ScriptKindSchema>;

/**
 * Organ systems, for preclinical study and the topic picker's filter chips.
 * `general` holds what isn't organ-specific: genetics, biochemistry, general
 * pharmacology and microbiology, toxicology.
 */
export const SYSTEMS = [
  'cardio',
  'pulm',
  'renal',
  'gi',
  'endo',
  'repro',
  'heme_onc',
  'neuro',
  'psych',
  'msk',
  'derm',
  'immuno',
  'general',
] as const;
export const SystemSchema = z.enum(SYSTEMS);
export type System = z.infer<typeof SystemSchema>;

/** Fields every kind of script has. */
const commonContent = {
  name: Text,
  aliases: TextList,
  /**
   * Organ systems the script is taught under. Required in content files
   * (`content:check`); defaults to empty for rows written before kinds existed.
   */
  systems: z.array(SystemSchema).default([]),
  /** Clinical rotations. Empty for preclinical-only scripts. */
  rotation: z.array(RotationSchema).default([]),
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
};

/** A disease: the illness script. */
export const DiseaseContentSchema = z.strictObject({
  kind: z.literal('disease'),
  ...commonContent,
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
});

/** A drug or drug class. The script is named for the class; members list its drugs. */
export const DrugContentSchema = z.strictObject({
  kind: z.literal('drug'),
  ...commonContent,
  class: Text,
  class_members: TextList,
  mechanism: Text,
  pharmacokinetics: TextList,
  indications: TextList.min(1),
  adverse_effects: TextList.min(1),
  contraindications: TextList,
  interactions: TextList,
  monitoring: TextList,
  overdose: z.strictObject({
    features: TextList,
    treatment: TextList,
  }),
});

/** A microorganism (bacterium, virus, fungus, parasite or prion). */
export const BugContentSchema = z.strictObject({
  kind: z.literal('bug'),
  ...commonContent,
  morphology: Text,
  lab_features: TextList,
  transmission: TextList,
  virulence_factors: TextList,
  diseases: TextList.min(1),
  diagnosis: TextList.min(1),
  treatment: TextList.min(1),
  prevention: TextList,
});

/** A biochemical or physiological pathway; vitamins count as pathways. */
export const PathwayContentSchema = z.strictObject({
  kind: z.literal('pathway'),
  ...commonContent,
  location: Text,
  purpose: Text,
  steps: TextList.min(1),
  rate_limiting_enzyme: Text.optional(),
  regulation: TextList,
  cofactors: TextList,
  deficiencies: TextList,
  drug_targets: TextList,
  treatment: TextList,
});

const CONTENT_BY_KIND = {
  disease: DiseaseContentSchema,
  drug: DrugContentSchema,
  bug: BugContentSchema,
  pathway: PathwayContentSchema,
} as const;

/** Scripts written before kinds existed have no `kind`: they are diseases. */
function withKind(value: unknown): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && !('kind' in value)) {
    return { ...value, kind: 'disease' };
  }
  return value;
}

/** The content of a script: stored as `content jsonb` in Postgres. */
export const IllnessScriptContentSchema = z.preprocess(
  withKind,
  z.discriminatedUnion('kind', [
    DiseaseContentSchema,
    DrugContentSchema,
    BugContentSchema,
    PathwayContentSchema,
  ]),
);
export type IllnessScriptContent = z.infer<typeof IllnessScriptContentSchema>;
export type DiseaseContent = z.infer<typeof DiseaseContentSchema>;
export type DrugContent = z.infer<typeof DrugContentSchema>;
export type BugContent = z.infer<typeof BugContentSchema>;
export type PathwayContent = z.infer<typeof PathwayContentSchema>;

/** Review metadata: stored as real columns so Postgres can enforce it. */
export const IllnessScriptMetaSchema = z.strictObject({
  id: ScriptIdSchema,
  status: ScriptStatusSchema,
  version: z.number().int().positive(),
  /** Reviewer initials or handle. Text for Stage 1; reviewers have no accounts yet. */
  reviewed_by: Text.max(64).nullable(),
  reviewed_at: z.iso.datetime({ offset: true }).nullable(),
});

const metaShape = IllnessScriptMetaSchema.shape;
const ScriptUnionSchema = z.discriminatedUnion('kind', [
  DiseaseContentSchema.extend(metaShape),
  DrugContentSchema.extend(metaShape),
  BugContentSchema.extend(metaShape),
  PathwayContentSchema.extend(metaShape),
]);

/** A script of any kind: review metadata plus its kind's content. */
export const IllnessScriptSchema = z
  .preprocess(withKind, ScriptUnionSchema)
  .superRefine((script, ctx) => {
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
export type DiseaseScript = Extract<IllnessScript, { kind: 'disease' }>;
export type DrugScript = Extract<IllnessScript, { kind: 'drug' }>;
export type BugScript = Extract<IllnessScript, { kind: 'bug' }>;
export type PathwayScript = Extract<IllnessScript, { kind: 'pathway' }>;

/** The content schema for one kind (used by tests and tooling). */
export function contentSchemaFor(kind: ScriptKind) {
  return CONTENT_BY_KIND[kind];
}

/** Only approved scripts may be used for pimping (domain rule 2). */
export function isPimpable(script: Pick<IllnessScript, 'status'>): boolean {
  return script.status === 'approved';
}
