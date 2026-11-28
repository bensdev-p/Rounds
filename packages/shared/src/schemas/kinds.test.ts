/**
 * Script kinds (domain rule 1, widened 27 Nov 2026): disease, drug, bug and
 * pathway. Content here is fictional, like the fixtures.
 */
import { describe, expect, it } from 'vitest';
import { TEST_SCRIPTS } from '../fixtures/index.ts';
import { validateContent } from '../db/seed.ts';
import { renderReviewSheet, type ContentFile } from '../content/contentFile.ts';
import { missLabel } from '../progress/missCard.ts';
import { collectStrings } from './fieldPath.ts';
import { IllnessScriptSchema, type IllnessScript } from './illnessScript.ts';
import { rungLabel, RUNG_LABELS_BY_KIND } from './kindLabels.ts';
import { RUNGS, QuestionSchema, traceQuestionToScript } from './question.ts';
import { scriptSections } from './scriptSections.ts';

const common = {
  status: 'in_review',
  version: 1,
  reviewed_by: null,
  reviewed_at: null,
  aliases: [],
  systems: ['general'],
  rotation: [],
  confused_with: [],
  pearls: ['Fictional pearl.'],
  difficulty_tiers: { 'MS1-2': [], MS3: [], MS4: [] },
  anki_refs: [],
  sources: [{ title: 'Rounds test fixture (fictional)' }],
};

const drugRaw = {
  ...common,
  id: 'glimmerzine',
  kind: 'drug',
  name: 'Glimmerzine',
  class: 'Fictional glimmer gland blocker',
  class_members: ['glimmerzine', 'glimmerol'],
  mechanism: 'Blocks the fictional blorp receptor.',
  pharmacokinetics: ['renal excretion'],
  indications: ['Zorblax syndrome'],
  adverse_effects: ['purple tongue', 'itchy elbows'],
  contraindications: ['quellan fever'],
  interactions: ['doubles blorp levels with zorbicillin'],
  monitoring: ['serum blorp'],
  overdose: { features: ['green vision'], treatment: ['blorp antidote'] },
};

const bugRaw = {
  ...common,
  id: 'quellan-bacillus',
  kind: 'bug',
  name: 'Quellan bacillus',
  morphology: 'Fictional square rod',
  lab_features: ['grows on toast agar'],
  transmission: ['quellan bites'],
  virulence_factors: ['nail matrix toxin'],
  diseases: ['Quellan fever'],
  diagnosis: ['quellan PCR'],
  treatment: ['supportive care'],
  prevention: ['bite nets'],
};

const pathwayRaw = {
  ...common,
  id: 'blorp-cycle',
  kind: 'pathway',
  name: 'Blorp cycle',
  location: 'Fictional glimmer gland cytosol',
  purpose: 'Makes blorp from glim.',
  steps: ['glim to proto-blorp by glimase', 'proto-blorp to blorp by blorpase'],
  rate_limiting_enzyme: 'glimase',
  regulation: ['inhibited by blorp'],
  cofactors: ['vitamin Z'],
  deficiencies: ['glimase deficiency causes Zorblax syndrome'],
  drug_targets: ['glimmerzine blocks glimase'],
  treatment: ['dietary blorp'],
};

const parse = (raw: unknown): IllnessScript => IllnessScriptSchema.parse(raw);
const accepts = (raw: unknown): boolean => IllnessScriptSchema.safeParse(raw).success;

describe('script kinds', () => {
  it('parses each kind with its own fields', () => {
    expect(parse(drugRaw).kind).toBe('drug');
    expect(parse(bugRaw).kind).toBe('bug');
    expect(parse(pathwayRaw).kind).toBe('pathway');
  });

  it('treats a script without a kind as a disease, so rows from before kinds still load', () => {
    const old: Record<string, unknown> = structuredClone(TEST_SCRIPTS[0]!);
    delete old.kind;
    delete old.systems;
    const script = parse(old);
    expect(script.kind).toBe('disease');
    expect(script.systems).toEqual([]);
  });

  it("rejects another kind's fields, unknown kinds and missing required fields", () => {
    expect(accepts({ ...drugRaw, diseases: ['x'] })).toBe(false);
    expect(accepts({ ...drugRaw, indications: [] })).toBe(false);
    expect(accepts({ ...bugRaw, kind: 'virus' })).toBe(false);
    expect(accepts({ ...pathwayRaw, steps: [] })).toBe(false);
    expect(accepts({ ...bugRaw, systems: ['micro'] })).toBe(false);
  });

  it('allows a pathway without a rate-limiting enzyme', () => {
    const rest: Record<string, unknown> = { ...pathwayRaw };
    delete rest.rate_limiting_enzyme;
    expect(accepts(rest)).toBe(true);
  });

  it('traces questions to kind-specific fields', () => {
    const drug = parse(drugRaw);
    const question = QuestionSchema.parse({
      id: 'glimmerzine.workup.1',
      script_id: 'glimmerzine',
      script_version: 1,
      rung: 'workup',
      kind: 'single',
      prompt: 'An adverse effect of glimmerzine?',
      source_fields: ['adverse_effects'],
      accepted_answers: [{ answer: 'purple tongue', synonyms: [] }],
    });
    expect(traceQuestionToScript(question, drug)).toEqual([]);
    expect(
      traceQuestionToScript({ ...question, source_fields: ['management.first_line'] }, drug),
    ).not.toEqual([]);
  });

  it('keeps confused_with links within a kind', () => {
    const drug = parse({
      ...drugRaw,
      confused_with: [{ script_id: 'zorblax-syndrome', how_to_tell_apart: 'One is a drug.' }],
    });
    expect(validateContent([...TEST_SCRIPTS, drug], [])).toContain(
      'glimmerzine: confused_with links a drug to a disease (zorblax-syndrome); links stay within a kind',
    );
    const other = parse({ ...drugRaw, id: 'glimmerol', name: 'Glimmerol' });
    const linked = parse({
      ...drugRaw,
      confused_with: [{ script_id: 'glimmerol', how_to_tell_apart: 'Glimmerol lasts longer.' }],
    });
    expect(validateContent([linked, other], [])).toEqual([]);
  });
});

describe('rung labels by kind', () => {
  it('gives every kind six labels and keeps the disease labels', () => {
    for (const labels of Object.values(RUNG_LABELS_BY_KIND)) {
      expect(RUNGS.every((r) => labels[r].length > 0)).toBe(true);
    }
    expect(RUNGS.map((r) => rungLabel(r))).toEqual([
      'Recall',
      'Next most common',
      'Tell it apart',
      'Workup',
      'Management',
      'Pearl',
    ]);
  });

  it("names the miss by the kind's rung", () => {
    expect(missLabel('workup', 'drug')).toBe('Pimped on adverse effects');
    expect(missLabel('management', 'bug')).toBe('Pimped on treatment');
    expect(missLabel('differentiate', 'pathway')).toBe('Pimped on deficiency');
    expect(missLabel('management')).toBe('Pimped on management');
  });
});

describe('sections and review sheets by kind', () => {
  it('shows every content field of each kind', () => {
    for (const raw of [drugRaw, bugRaw, pathwayRaw]) {
      const script = parse(raw);
      const shown = new Set(scriptSections(script).flatMap((s) => s.parts.flatMap((p) => p.items)));
      const own = Object.entries(raw).filter(
        ([key]) => !(key in common) && !['id', 'kind', 'name'].includes(key),
      );
      for (const [key, value] of own) {
        for (const text of collectStrings(value)) {
          expect(shown.has(text), `${script.kind}.${key}: ${text}`).toBe(true);
        }
      }
    }
  });

  it("prints a drug's sheet with its sections and rung labels", () => {
    const file: ContentFile = { script: parse(drugRaw), questions: [] };
    const sheet = renderReviewSheet(file, new Map());
    expect(sheet).toContain('Drug script. Status: **in_review**');
    expect(sheet).toContain('## Class\nFictional glimmer gland blocker');
    expect(sheet).toContain('**Members**\n- glimmerzine\n- glimmerol');
    expect(sheet).toContain('### 4. Adverse effects');
    expect(sheet).toContain('### 5. Tell it apart');
  });
});
