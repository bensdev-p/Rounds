import { describe, expect, it } from 'vitest';
import type { SessionRecord } from '../progress/progression.ts';
import { NewPatientLogSchema, PatientLogSchema } from '../schemas/patientLog.ts';
import {
  clockLabel,
  isSameLocalDay,
  logStatus,
  matchScripts,
  patientCountLabel,
  startOfToday,
} from './patientLog.ts';

const SCRIPTS = [
  {
    id: 'heart-failure-exacerbation',
    name: 'Acute decompensated heart failure',
    aliases: ['heart failure exacerbation', 'ADHF', 'CHF exacerbation'],
  },
  { id: 'diabetic-ketoacidosis', name: 'Diabetic ketoacidosis', aliases: ['DKA'] },
  { id: 'hyperkalemia', name: 'Hyperkalemia', aliases: ['high potassium'] },
  { id: 'hyponatremia', name: 'Hyponatremia', aliases: ['low sodium'] },
];
const ids = (label: string) => matchScripts(label, SCRIPTS).map((m) => m.item.id);

describe('matchScripts', () => {
  it('matches names and aliases as the student types', () => {
    expect(ids('dka')).toEqual(['diabetic-ketoacidosis']);
    expect(ids('Diabetic k')).toEqual(['diabetic-ketoacidosis']);
    expect(ids('hyp')).toEqual(['hyperkalemia', 'hyponatremia']);
    expect(ids('failure')).toEqual(['heart-failure-exacerbation']);
  });

  it('finds a script when the label holds a whole alias among other words', () => {
    expect(ids('Mr. Alvarez CHF exacerbation')).toEqual(['heart-failure-exacerbation']);
  });

  it('puts exact matches first and marks them', () => {
    const matches = matchScripts('DKA', SCRIPTS);
    expect(matches[0]).toMatchObject({ item: { id: 'diabetic-ketoacidosis' }, exact: true });
    expect(matchScripts('Diabetic', SCRIPTS)[0]?.exact).toBe(false);
  });

  it('ignores case, punctuation and an empty label', () => {
    expect(ids('  DIABETIC ketoacidosis! ')).toEqual(['diabetic-ketoacidosis']);
    expect(ids('   ')).toEqual([]);
    expect(ids('Zorblax syndrome')).toEqual([]);
  });

  it('returns at most the limit', () => {
    expect(matchScripts('a', SCRIPTS, 2)).toHaveLength(2);
  });
});

describe('today helpers', () => {
  const now = new Date(2026, 10, 14, 15, 30);

  it('starts today at local midnight', () => {
    expect(new Date(startOfToday(now)).getTime()).toBe(new Date(2026, 10, 14).getTime());
  });

  it('compares local days', () => {
    expect(isSameLocalDay(new Date(2026, 10, 14, 0, 1).toISOString(), now)).toBe(true);
    expect(isSameLocalDay(new Date(2026, 10, 13, 23, 59).toISOString(), now)).toBe(false);
  });

  it('labels the clock as in home.png', () => {
    expect(clockLabel(new Date(2026, 10, 14, 8, 12).toISOString())).toBe('8:12 am');
    expect(clockLabel(new Date(2026, 10, 14, 13, 5).toISOString())).toBe('1:05 pm');
    expect(clockLabel(new Date(2026, 10, 14, 0, 0).toISOString())).toBe('12:00 am');
    expect(clockLabel(new Date(2026, 10, 14, 12, 40).toISOString())).toBe('12:40 pm');
  });

  it('counts patients', () => {
    expect(patientCountLabel(1)).toBe('1 patient');
    expect(patientCountLabel(3)).toBe('3 patients');
  });
});

describe('logStatus', () => {
  const now = new Date(2026, 10, 14, 18, 0);
  const at = (h: number, day = 14) => new Date(2026, 10, day, h).toISOString();
  const session = (script_id: string, score: number, ended_at: string): SessionRecord => ({
    script_id,
    score,
    status: score === 6 ? 'completed' : 'missed',
    ended_at,
  });

  it("shows today's best rung on the script", () => {
    const sessions = [
      session('diabetic-ketoacidosis', 3, at(9)),
      session('diabetic-ketoacidosis', 5, at(12)),
      session('hyperkalemia', 6, at(10)),
    ];
    expect(logStatus('diabetic-ketoacidosis', sessions, now)).toEqual({
      tone: 'pass',
      label: 'Pimped, rung 5',
    });
  });

  it('is "Not yet" when the only sessions were on other days or scripts', () => {
    const sessions = [
      session('diabetic-ketoacidosis', 6, at(20, 13)),
      session('hyperkalemia', 4, at(10)),
    ];
    expect(logStatus('diabetic-ketoacidosis', sessions, now)).toEqual({
      tone: 'signal',
      label: 'Not yet',
    });
  });

  it('says so when the log has no script', () => {
    expect(logStatus(null, [], now)).toEqual({ tone: 'none', label: 'No script yet' });
  });
});

describe('patient log schemas', () => {
  it('accepts a diagnosis label, with or without a script', () => {
    expect(
      NewPatientLogSchema.parse({
        label: ' DKA ',
        script_id: 'diabetic-ketoacidosis',
        rotation: 'IM',
      }),
    ).toEqual({ label: 'DKA', script_id: 'diabetic-ketoacidosis', rotation: 'IM' });
    expect(
      NewPatientLogSchema.safeParse({ label: 'Zorblax', script_id: null, rotation: 'IM' }).success,
    ).toBe(true);
  });

  it('refuses patient details, blank labels and extra fields', () => {
    const bad = [
      { label: 'Mr. Alvarez CHF', script_id: null, rotation: 'IM' },
      { label: 'DKA 3/14', script_id: null, rotation: 'IM' },
      { label: '   ', script_id: null, rotation: 'IM' },
      { label: 'DKA', script_id: null, rotation: 'IM', bed: '4B' },
    ];
    for (const log of bad) expect(NewPatientLogSchema.safeParse(log).success).toBe(false);
  });

  it('reads stored logs', () => {
    expect(
      PatientLogSchema.safeParse({
        id: '6f1c2c4e-8a2b-4c1d-9e3f-0a1b2c3d4e5f',
        label: 'DKA',
        script_id: null,
        rotation: 'IM',
        logged_at: '2026-11-14T08:12:00.000Z',
      }).success,
    ).toBe(true);
  });
});
