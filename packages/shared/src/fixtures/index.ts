/**
 * FICTIONAL test fixtures. These diseases do not exist. They let tests and the
 * Stage 1 demo exercise the ladder without putting unreviewed medical content
 * in the repo. Never ship them as real content.
 */
import { IllnessScriptSchema, type IllnessScript } from '../schemas/illnessScript.ts';
import { QuestionSchema, type Question } from '../schemas/question.ts';

const zorblax = IllnessScriptSchema.parse({
  id: 'zorblax-syndrome',
  status: 'approved',
  version: 1,
  reviewed_by: 'TEST',
  reviewed_at: '2026-11-13T00:00:00Z',
  name: 'Zorblax syndrome',
  aliases: ['ZBX'],
  rotation: ['IM'],
  epidemiology: {
    who: 'Fictional adults over 40 (test fixture, not a real disease)',
    risk_factors: ['glimmer exposure', 'night shift work', 'low blorp diet', 'family history'],
  },
  pathophysiology: 'Fictional autoimmune attack on the glimmer gland.',
  timeline: { onset: 'Subacute, over weeks', course: 'Relapsing-remitting' },
  key_findings: {
    history: ['purple fatigue', 'itchy elbows'],
    exam: ['blue nail beds'],
    labs: ['high serum blorp'],
    imaging: ['swollen glimmer gland on ultrasound'],
  },
  diagnosis: {
    confirmatory_tests: ['anti-glimmer antibody'],
    criteria: ['serum blorp above 40 units with blue nail beds'],
  },
  management: { first_line: ['zorbicillin'], next_line: ['plasma swap'] },
  complications: ['glimmer storm'],
  confused_with: [
    {
      script_id: 'quellan-fever',
      how_to_tell_apart: 'Quellan fever causes green nail beds and a normal blorp.',
    },
  ],
  pearls: ['Zorblax syndrome never causes fever.'],
  difficulty_tiers: {
    'MS1-2': ['pathophysiology'],
    MS3: ['key_findings.exam[0]', 'management.first_line'],
    MS4: ['pearls[0]'],
  },
  anki_refs: [{ kind: 'note', id: '1000000001' }],
  sources: [{ title: 'Rounds test fixture (fictional)' }],
});

const quellan = IllnessScriptSchema.parse({
  id: 'quellan-fever',
  status: 'approved',
  version: 1,
  reviewed_by: 'TEST',
  reviewed_at: '2026-11-13T00:00:00Z',
  name: 'Quellan fever',
  aliases: ['QF'],
  rotation: ['IM'],
  epidemiology: { who: 'Fictional travelers (test fixture)', risk_factors: ['quellan bites'] },
  pathophysiology: 'Fictional infection of the nail matrix.',
  timeline: { onset: 'Acute, over days', course: 'Self-limited' },
  key_findings: {
    history: ['fever', 'purple fatigue'],
    exam: ['green nail beds'],
    labs: ['normal blorp'],
    imaging: [],
  },
  diagnosis: { confirmatory_tests: ['quellan PCR'], criteria: [] },
  management: { first_line: ['supportive care'], next_line: [] },
  complications: [],
  confused_with: [
    {
      script_id: 'zorblax-syndrome',
      how_to_tell_apart: 'Zorblax syndrome causes blue nail beds, high blorp and no fever.',
    },
  ],
  pearls: [],
  difficulty_tiers: { 'MS1-2': [], MS3: ['key_findings.exam[0]'], MS4: [] },
  anki_refs: [],
  sources: [{ title: 'Rounds test fixture (fictional)' }],
});

export const TEST_SCRIPTS: readonly IllnessScript[] = [zorblax, quellan];

const FIXTURE_IDS: ReadonlySet<string> = new Set(TEST_SCRIPTS.map((s) => s.id));

/** The fictional fixtures are seeded for tests; students' screens leave them out. */
export function isFixtureScript(scriptId: string): boolean {
  return FIXTURE_IDS.has(scriptId);
}

const q = (raw: unknown): Question => QuestionSchema.parse(raw);

export const TEST_QUESTIONS: readonly Question[] = [
  q({
    id: 'zorblax-syndrome.recall.1',
    script_id: 'zorblax-syndrome',
    script_version: 1,
    rung: 'recall',
    kind: 'single',
    prompt: 'An adult has purple fatigue, itchy elbows and blue nail beds. Most likely diagnosis?',
    source_fields: ['name'],
    accepted_answers: [{ answer: 'Zorblax syndrome', synonyms: ['zorblax', 'ZBX'] }],
  }),
  q({
    id: 'zorblax-syndrome.second-order.1',
    script_id: 'zorblax-syndrome',
    script_version: 1,
    rung: 'second_order',
    kind: 'list',
    prompt: 'Name 3 risk factors for Zorblax syndrome.',
    source_fields: ['epidemiology.risk_factors'],
    required_count: 3,
    accepted_answers: [
      { answer: 'glimmer exposure', synonyms: ['glimmer'] },
      { answer: 'night shift work', synonyms: ['night shift', 'shift work'] },
      { answer: 'low blorp diet', synonyms: ['low blorp'] },
      { answer: 'family history', synonyms: ['family hx', 'genetics'] },
    ],
  }),
  q({
    id: 'zorblax-syndrome.differentiate.1',
    script_id: 'zorblax-syndrome',
    script_version: 1,
    rung: 'differentiate',
    kind: 'single',
    prompt: 'On exam, how do you tell it apart from Quellan fever?',
    source_fields: ['key_findings.exam', 'confused_with[0].how_to_tell_apart'],
    accepted_answers: [
      { answer: 'blue nail beds', synonyms: ['blue nails'] },
      { answer: 'green nail beds', synonyms: ['green nails'] },
    ],
  }),
  q({
    id: 'zorblax-syndrome.workup.1',
    script_id: 'zorblax-syndrome',
    script_version: 1,
    rung: 'workup',
    kind: 'single',
    prompt: 'What test confirms the diagnosis?',
    source_fields: ['diagnosis.confirmatory_tests'],
    accepted_answers: [
      { answer: 'anti-glimmer antibody', synonyms: ['anti glimmer', 'glimmer antibody'] },
    ],
  }),
  q({
    id: 'zorblax-syndrome.management.1',
    script_id: 'zorblax-syndrome',
    script_version: 1,
    rung: 'management',
    kind: 'single',
    prompt: 'First-line treatment?',
    source_fields: ['management.first_line'],
    accepted_answers: [{ answer: 'zorbicillin', synonyms: [] }],
  }),
  q({
    id: 'zorblax-syndrome.pearl.1',
    script_id: 'zorblax-syndrome',
    script_version: 1,
    rung: 'pearl',
    kind: 'single',
    prompt: 'Which vital-sign finding argues against Zorblax syndrome?',
    source_fields: ['pearls[0]'],
    accepted_answers: [{ answer: 'fever', synonyms: ['febrile', 'high temperature'] }],
  }),
];

/**
 * Extra questions on rungs that already have one, so the seed and the
 * integration tests cover a script with more than one question per rung.
 * Kept apart from TEST_QUESTIONS, which is exactly one ladder.
 */
export const TEST_QUESTION_VARIANTS: readonly Question[] = [
  q({
    id: 'zorblax-syndrome.management.2',
    script_id: 'zorblax-syndrome',
    script_version: 1,
    rung: 'management',
    kind: 'single',
    prompt: 'Zorbicillin has failed. What next?',
    source_fields: ['management.next_line'],
    accepted_answers: [{ answer: 'plasma swap', synonyms: ['plasma exchange'] }],
  }),
];

export function testQuestionsFor(scriptId: string): Question[] {
  return TEST_QUESTIONS.filter((question) => question.script_id === scriptId);
}
