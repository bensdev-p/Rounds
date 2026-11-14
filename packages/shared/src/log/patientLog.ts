/**
 * Pure logic for the patient log (wireframe 08) and Home's "From today's
 * patients" (wireframe 02 note 3).
 */
import { dayKey, type SessionRecord } from '../progress/progression.ts';
import { containsTerm, normalize } from '../text.ts';

// ─── Matching scripts ───────────────────────────────────────────────────────

export interface Matchable {
  name: string;
  aliases: readonly string[];
}

export interface ScriptMatch<T> {
  item: T;
  /** True when the label is exactly the script's name or one of its aliases. */
  exact: boolean;
}

export const MAX_MATCHES = 5;

/**
 * How well a label matches one script: 0 exact, 1 a name starts with it,
 * 2 a name contains it, 3 the label contains a whole name ("Mr. Alvarez CHF
 * exacerbation" contains the alias "CHF exacerbation"). Null for no match.
 */
function matchRank(label: string, needle: string, { name, aliases }: Matchable): number | null {
  const names = [name, ...aliases];
  const normalized = names.map(normalize).filter(Boolean);
  if (normalized.some((n) => n === needle)) return 0;
  if (normalized.some((n) => n.startsWith(needle))) return 1;
  if (normalized.some((n) => n.includes(needle))) return 2;
  if (names.some((n) => containsTerm(label, n))) return 3;
  return null;
}

/**
 * Autocomplete for the patient log: scripts whose name or aliases match what
 * was typed, best first, at most `limit`.
 */
export function matchScripts<T extends Matchable>(
  label: string,
  items: readonly T[],
  limit = MAX_MATCHES,
): ScriptMatch<T>[] {
  const needle = normalize(label);
  if (!needle) return [];
  return items
    .map((item) => ({ item, rank: matchRank(label, needle, item) }))
    .filter((m): m is { item: T; rank: number } => m.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.item.name.localeCompare(b.item.name))
    .slice(0, limit)
    .map(({ item, rank }) => ({ item, exact: rank === 0 }));
}

// ─── Today ──────────────────────────────────────────────────────────────────

/** Local midnight at the start of `now`'s day, as an ISO timestamp. */
export function startOfToday(now: Date): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export function isSameLocalDay(iso: string, now: Date): boolean {
  return dayKey(new Date(iso)) === dayKey(now);
}

/** "8:12 am", "1:05 pm" (home.png). */
export function clockLabel(iso: string): string {
  const date = new Date(iso);
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

export function patientCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'patient' : 'patients'}`;
}

// ─── Logged today status ────────────────────────────────────────────────────

/** Wireframe 08 note 2: the dot is pass (pimped) or signal (not yet). */
export type LogStatusTone = 'pass' | 'signal' | 'none';

export interface LogStatus {
  tone: LogStatusTone;
  label: string;
}

/**
 * "Pimped, rung 5" from today's best finished session on the log's script,
 * "Not yet" when there is none, and "No script yet" when the label matched no
 * script.
 */
export function logStatus(
  scriptId: string | null,
  sessions: readonly SessionRecord[],
  now: Date,
): LogStatus {
  if (scriptId === null) return { tone: 'none', label: 'No script yet' };
  const today = sessions.filter((s) => s.script_id === scriptId && isSameLocalDay(s.ended_at, now));
  if (today.length === 0) return { tone: 'signal', label: 'Not yet' };
  const best = Math.max(...today.map((s) => s.score));
  return { tone: 'pass', label: `Pimped, rung ${best}` };
}
