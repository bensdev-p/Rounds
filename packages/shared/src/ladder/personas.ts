/**
 * Attending personas: same content, different pacing and tone.
 * `time_limit_ms` drives the `slow` miss tag; null means untimed.
 */
export const PERSONAS = {
  teacher: { label: 'Teacher', time_limit_ms: null, hints: true },
  internist: { label: 'Internist', time_limit_ms: 30_000, hints: false },
  surgeon: { label: 'Surgeon', time_limit_ms: 10_000, hints: false },
} as const satisfies Record<
  string,
  { label: string; time_limit_ms: number | null; hints: boolean }
>;

export type PersonaId = keyof typeof PERSONAS;
export const DEFAULT_PERSONA: PersonaId = 'teacher';
