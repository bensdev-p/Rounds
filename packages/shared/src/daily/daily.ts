/**
 * The daily pimp (M4.3): one script a day, the same for everyone, and a share
 * line that shows only the ladder's squares. Pure functions; the site supplies
 * the day (the visitor's own calendar date, developer's decision 2026-11-27)
 * and the pool (`daily_pool()` in the database).
 */
import { pickLadder } from '../ladder/engine.ts';
import type { Question } from '../schemas/question.ts';

/** A calendar day as YYYY-MM-DD. */
export type DayKey = string;

const DAY_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** The visitor's local calendar day for a moment in time. */
export function localDayKey(date: Date): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Days since 1970-01-01 for a day key. Throws on anything that isn't YYYY-MM-DD. */
export function dayNumber(day: DayKey): number {
  const match = DAY_KEY_RE.exec(day);
  if (!match) throw new Error(`Not a day: ${day}`);
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  if (new Date(ms).toISOString().slice(0, 10) !== day) throw new Error(`Not a day: ${day}`);
  return Math.round(ms / DAY_MS);
}

/** "Nov 16" */
export function shortDay(day: DayKey): string {
  return new Date(dayNumber(day) * DAY_MS).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** "Monday, November 16" */
export function longDay(day: DayKey): string {
  return new Date(dayNumber(day) * DAY_MS).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** A small seeded random generator (mulberry32), so every visitor gets the same picks. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** FNV-1a: a stable number from a string, for seeding. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** The pool shuffled for one cycle. Every script comes up once per cycle. */
function cycleOrder(pool: readonly string[], cycle: number): string[] {
  return shuffled(pool, seededRandom(hashString(`cycle:${cycle}`)));
}

/**
 * Today's script: the same for everyone with the same pool. The pool is
 * walked in a shuffled order, so each script comes up once before any repeats,
 * and a cycle never starts with the script that ended the last one.
 */
export function pickDailyScript(pool: readonly string[], day: DayKey): string | null {
  const sorted = [...new Set(pool)].sort();
  const n = sorted.length;
  if (n === 0) return null;
  const days = dayNumber(day);
  const cycle = Math.floor(days / n);
  const position = days - cycle * n;
  const order = cycleOrder(sorted, cycle);
  if (n > 1 && order[0] === cycleOrder(sorted, cycle - 1)[n - 1]) {
    [order[0], order[1]] = [order[1] as string, order[0] as string];
  }
  return order[position] ?? null;
}

/** Today's questions, one per rung, the same for everyone on that script and day. */
export function pickDailyLadder(questions: readonly Question[], day: DayKey): Question[] {
  const scriptId = questions[0]?.script_id ?? '';
  // Sorted first, so the order the rows arrive in can't change the pick.
  const sorted = [...questions].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return pickLadder(sorted, { random: seededRandom(hashString(`${day}:${scriptId}`)) });
}

export type DailySquare = 'cleared' | 'missed' | 'unreached';

export interface DailyOutcome {
  /** Rungs cleared before the miss, or all of them. */
  cleared: number;
  /** True when the ladder ended on a miss. */
  missed: boolean;
  /** Rungs in the ladder (6 for a full script). */
  total: number;
}

/** The ladder's squares, lowest rung first. */
export function dailySquares(outcome: DailyOutcome): DailySquare[] {
  return Array.from({ length: outcome.total }, (_, i) =>
    i < outcome.cleared
      ? 'cleared'
      : i === outcome.cleared && outcome.missed
        ? 'missed'
        : 'unreached',
  );
}

const SQUARE_EMOJI: Record<DailySquare, string> = {
  cleared: '🟩',
  missed: '🟥',
  unreached: '⬛',
};

/**
 * What the share button sends. Squares and the score only: never the
 * script, the questions or the answers.
 *
 *   🟩🟩🟩🟩🟥⬛
 *   PimpMe · Nov 16 · 4/6 · pimpme.app/daily
 */
export function dailyShareText(day: DayKey, outcome: DailyOutcome, domain = 'pimpme.app'): string {
  const squares = dailySquares(outcome)
    .map((s) => SQUARE_EMOJI[s])
    .join('');
  return `${squares}\nPimpMe · ${shortDay(day)} · ${outcome.cleared}/${outcome.total} · ${domain}/daily`;
}
