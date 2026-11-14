/**
 * The student's profile (M2.3): what onboarding records (wireframe 01) and
 * what Settings changes (wireframe 12). Pure logic only; the API reads and
 * writes the `profiles` table.
 */
import { z } from 'zod';
import { PERSONAS, type PersonaId } from '../ladder/personas.ts';
import { DEFAULT_ROUNDS_GOAL } from '../progress/progression.ts';
import { RotationSchema, type Rotation } from '../schemas/illnessScript.ts';

export const YEARS = ['MS1', 'MS2', 'MS3', 'MS4'] as const;
export const YearSchema = z.enum(YEARS);
export type Year = z.infer<typeof YearSchema>;

/** Sessions per day that finish rounds: 3 by default, 1 to 5 (DESIGN.md → Progression). */
export const MIN_ROUNDS_GOAL = 1;
export const MAX_ROUNDS_GOAL = 5;

export const MAX_ROTATION_WEEKS = 52;
/** What onboarding's week rows start at. */
export const DEFAULT_ROTATION_WEEKS = 8;

/** Wireframe 12 note 2: the persona's time limit, a fixed one, or none. */
export const ANSWER_TIMEOUTS = ['persona', '10s', '30s', '60s', 'off'] as const;
export const AnswerTimeoutSchema = z.enum(ANSWER_TIMEOUTS);
export type AnswerTimeout = z.infer<typeof AnswerTimeoutSchema>;

const PersonaSchema = z.enum(Object.keys(PERSONAS) as [PersonaId, ...PersonaId[]]);

/** A calendar day, "2026-11-02", read as local time. */
export const LocalDateSchema = z.iso.date();

export const ProfileSchema = z
  .strictObject({
    year: YearSchema,
    rotation: RotationSchema,
    /** The Monday the rotation's first week began. Null with `rotation_weeks` when skipped. */
    rotation_started_on: LocalDateSchema.nullable(),
    rotation_weeks: z.number().int().min(1).max(MAX_ROTATION_WEEKS).nullable(),
    daily_goal: z.number().int().min(MIN_ROUNDS_GOAL).max(MAX_ROUNDS_GOAL),
    persona: PersonaSchema,
    answer_timeout: AnswerTimeoutSchema,
  })
  .refine((p) => (p.rotation_started_on === null) === (p.rotation_weeks === null), {
    message: 'The rotation start and length are set together',
  });
export type Profile = z.infer<typeof ProfileSchema>;

/** A new profile with the defaults for everything onboarding doesn't ask. */
export function newProfile(fields: Pick<Profile, 'year' | 'rotation'> & Partial<Profile>): Profile {
  return ProfileSchema.parse({
    rotation_started_on: null,
    rotation_weeks: null,
    daily_goal: DEFAULT_ROUNDS_GOAL,
    persona: 'teacher',
    answer_timeout: 'persona',
    ...fields,
  });
}

// ─── Rotation weeks ─────────────────────────────────────────────────────────

const DAY_MS = 86_400_000;

function localDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalDate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

function formatLocalDate(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Whole days from `from` to `to`, by the calendar (safe across clock changes). */
function daysBetween(from: Date, to: Date): number {
  return Math.round((localDay(to).getTime() - localDay(from).getTime()) / DAY_MS);
}

/** The Monday on or before `date`. */
function mondayOf(date: Date): Date {
  const day = localDay(date);
  const sinceMonday = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - sinceMonday);
  return day;
}

/**
 * The rotation's first Monday, from "I'm in week 3" today. Onboarding asks
 * which week it is rather than for a date, so weeks turn over on Mondays.
 */
export function rotationStartForWeek(week: number, now: Date): string {
  const start = mondayOf(now);
  start.setDate(start.getDate() - (Math.max(1, Math.floor(week)) - 1) * 7);
  return formatLocalDate(start);
}

export interface RotationWeek {
  week: number;
  of: number;
}

/**
 * Home's "Week 3 of 8". Null when the dates weren't given, before the
 * rotation starts or after it ends (the line is left out then).
 */
export function weekOfRotation(
  profile: Pick<Profile, 'rotation_started_on' | 'rotation_weeks'>,
  now: Date,
): RotationWeek | null {
  const { rotation_started_on: startedOn, rotation_weeks: weeks } = profile;
  if (startedOn === null || weeks === null) return null;
  const days = daysBetween(parseLocalDate(startedOn), now);
  if (days < 0) return null;
  const week = Math.floor(days / 7) + 1;
  return week > weeks ? null : { week, of: weeks };
}

// ─── Answer timeout ─────────────────────────────────────────────────────────

const FIXED_TIMEOUT_MS: Record<Exclude<AnswerTimeout, 'persona' | 'off'>, number> = {
  '10s': 10_000,
  '30s': 30_000,
  '60s': 60_000,
};

/** The time limit for the `slow` miss tag: the persona's, unless Settings overrides it. */
export function answerTimeLimit(persona: PersonaId, timeout: AnswerTimeout): number | null {
  if (timeout === 'persona') return PERSONAS[persona].time_limit_ms;
  if (timeout === 'off') return null;
  return FIXED_TIMEOUT_MS[timeout];
}

export function answerTimeoutLabel(timeout: AnswerTimeout): string {
  switch (timeout) {
    case 'persona':
      return 'Persona default';
    case 'off':
      return 'No limit';
    default:
      return `${FIXED_TIMEOUT_MS[timeout] / 1000} s`;
  }
}

// ─── Script pool and sign-in ────────────────────────────────────────────────

export interface RotationPool {
  scriptIds: string[];
  /** True when the rotation has no scripts yet, so the pool is every script. */
  fallback: boolean;
}

/**
 * The scripts "Pimp me" picks from: the rotation's. A rotation with no scripts
 * yet (only internal medicine has them) falls back to every script, and Home
 * says so.
 */
export function rotationPool(
  rotation: Rotation,
  scripts: readonly { id: string; rotation: readonly Rotation[] }[],
): RotationPool {
  const inRotation = scripts.filter((s) => s.rotation.includes(rotation)).map((s) => s.id);
  if (inRotation.length > 0 || scripts.length === 0) {
    return { scriptIds: inRotation, fallback: false };
  }
  return { scriptIds: scripts.map((s) => s.id), fallback: true };
}

/**
 * Wireframe 01 note 2: no account wall; sign-in is asked for after the first
 * session, once.
 */
export function shouldAskToSignIn(input: {
  isAnonymous: boolean;
  finishedLadders: number;
  alreadyAsked: boolean;
}): boolean {
  return input.isAnonymous && !input.alreadyAsked && input.finishedLadders >= 1;
}
