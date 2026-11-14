/**
 * Progression (docs/design/DESIGN.md → Progression). Everything here is derived
 * from finished ladder sessions, so there is no separate points store.
 * Days are the student's local calendar days.
 */
import { RUNGS } from '../schemas/question.ts';

/** A finished ladder session, as needed for progression. */
export interface SessionRecord {
  script_id: string;
  /** Rungs climbed, 0–6. */
  score: number;
  status: 'missed' | 'completed';
  /** ISO timestamp the session ended. */
  ended_at: string;
}

export const TOP_RUNG = RUNGS.length;
export const DEFAULT_ROUNDS_GOAL = 3;
/** Days after the last top-rung run before a mastered script needs a re-check. */
export const RECHECK_AFTER_DAYS = 30;

// ─── Days ───────────────────────────────────────────────────────────────────

/** Local calendar day as `YYYY-MM-DD`. */
export function dayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

function addDays(key: string, days: number): string {
  const date = fromDayKey(key);
  date.setDate(date.getDate() + days);
  return dayKey(date);
}

/** The Monday that starts the week containing `key`. */
function weekOf(key: string): string {
  const date = fromDayKey(key);
  const sinceMonday = (date.getDay() + 6) % 7;
  return addDays(key, -sinceMonday);
}

function daysBetween(from: string, to: string): number {
  return Math.round((fromDayKey(to).getTime() - fromDayKey(from).getTime()) / 86_400_000);
}

const endedDay = (s: SessionRecord): string => dayKey(new Date(s.ended_at));

// ─── Today's rounds and shifts ──────────────────────────────────────────────

export interface RoundsToday {
  done: number;
  goal: number;
  complete: boolean;
}

/** Sessions finished today toward the daily goal (3 by default). */
export function roundsToday(
  sessions: readonly SessionRecord[],
  now: Date,
  goal: number = DEFAULT_ROUNDS_GOAL,
): RoundsToday {
  const today = dayKey(now);
  const done = sessions.filter((s) => endedDay(s) === today).length;
  return { done, goal, complete: done >= goal };
}

/** Days on which rounds were finished (at least `goal` sessions). */
export function shiftDays(
  sessions: readonly SessionRecord[],
  goal: number = DEFAULT_ROUNDS_GOAL,
): Set<string> {
  const perDay = new Map<string, number>();
  for (const s of sessions) perDay.set(endedDay(s), (perDay.get(endedDay(s)) ?? 0) + 1);
  return new Set([...perDay].filter(([, n]) => n >= goal).map(([day]) => day));
}

export interface ShiftStreak {
  /** Consecutive shifts, counting post-call days as neither a shift nor a break. */
  count: number;
  /** Whether today is already a shift. */
  today: boolean;
  /** Days forgiven as post-call inside the streak. */
  postCall: string[];
}

/**
 * Consecutive shifts ending today (or yesterday, if today isn't finished yet:
 * the day isn't over). One missed day per Monday-to-Sunday week is a post-call
 * day and doesn't break the streak. A reset is never announced; the count just
 * starts again.
 */
export function shiftStreak(
  sessions: readonly SessionRecord[],
  now: Date,
  goal: number = DEFAULT_ROUNDS_GOAL,
): ShiftStreak {
  const shifts = shiftDays(sessions, goal);
  const today = dayKey(now);
  const todayIsShift = shifts.has(today);
  const earliest = [...shifts].sort()[0];
  if (earliest === undefined) return { count: 0, today: false, postCall: [] };

  let count = todayIsShift ? 1 : 0;
  const postCall: string[] = [];
  // A forgiven day only joins the streak once an earlier shift is found.
  let pending: string | null = null;
  const forgivenWeeks = new Set<string>();
  for (let day = addDays(today, -1); day >= earliest; day = addDays(day, -1)) {
    if (shifts.has(day)) {
      count += 1;
      if (pending) postCall.push(pending);
      pending = null;
      continue;
    }
    const week = weekOf(day);
    if (forgivenWeeks.has(week) || pending) break;
    forgivenWeeks.add(week);
    pending = day;
  }
  return { count, today: todayIsShift, postCall };
}

// ─── Rank ───────────────────────────────────────────────────────────────────

export const RANKS = [
  { title: 'MS3', min: 0 },
  { title: 'Sub-I', min: 150 },
  { title: 'Intern', min: 500 },
  { title: 'Resident', min: 1_200 },
  { title: 'Chief', min: 2_500 },
  { title: 'Attending', min: 5_000 },
] as const;

export type RankTitle = (typeof RANKS)[number]['title'];

export interface RankStatus {
  title: RankTitle;
  /** 0–5, position in RANKS. */
  index: number;
  totalRungs: number;
  next: { title: RankTitle; min: number } | null;
  /** Rungs still needed for the next rank; null at the top. */
  toNext: number | null;
  /** 0–1 progress from this rank to the next; 1 at the top. */
  progress: number;
}

export function totalRungs(sessions: readonly SessionRecord[]): number {
  return sessions.reduce((sum, s) => sum + s.score, 0);
}

/** Rank from total rungs climbed. Rungs are never taken away, so rank never drops. */
export function rankFor(total: number): RankStatus {
  let index = 0;
  let rank: (typeof RANKS)[number] = RANKS[0];
  RANKS.forEach((r, i) => {
    if (total >= r.min) {
      index = i;
      rank = r;
    }
  });
  const next = RANKS[index + 1] ?? null;
  return {
    title: rank.title,
    index,
    totalRungs: total,
    next,
    toNext: next ? next.min - total : null,
    progress: next ? (total - rank.min) / (next.min - rank.min) : 1,
  };
}

// ─── Mastery ────────────────────────────────────────────────────────────────

export type MasteryStatus = 'not_tried' | 'in_progress' | 'mastered' | 'recheck_due';

/**
 * Mastered = rung 6 reached on two different days. Thirty days after the last
 * top-rung run it becomes "re-check due" until rung 6 is reached again.
 */
export function masteryFor(
  scriptId: string,
  sessions: readonly SessionRecord[],
  now: Date,
): MasteryStatus {
  const mine = sessions.filter((s) => s.script_id === scriptId);
  if (mine.length === 0) return 'not_tried';
  const topDays = [...new Set(mine.filter((s) => s.score >= TOP_RUNG).map(endedDay))].sort();
  const lastTop = topDays.at(-1);
  if (topDays.length < 2 || lastTop === undefined) return 'in_progress';
  return daysBetween(lastTop, dayKey(now)) > RECHECK_AFTER_DAYS
    ? 'recheck_due'
    : 'mastered';
}

/** Best rung on a script, or null if never finished. */
export function bestRungOn(scriptId: string, sessions: readonly SessionRecord[]): number | null {
  const scores = sessions.filter((s) => s.script_id === scriptId).map((s) => s.score);
  return scores.length > 0 ? Math.max(...scores) : null;
}

// ─── The session result ─────────────────────────────────────────────────────

export type Badge = 'clean_run' | 'script_mastered' | 'new_best';

export interface ResultSummary {
  score: number;
  completed: boolean;
  /** Best on this script before this session; null if first time. */
  previousBest: number | null;
  newBest: boolean;
  badges: Badge[];
  rounds: RoundsToday;
  streak: ShiftStreak;
  rankBefore: RankStatus;
  rankAfter: RankStatus;
  promoted: boolean;
  mastery: MasteryStatus;
}

/**
 * Everything the result screen shows, from the sessions before this one plus
 * this one. `anyPartial`: whether any answer in the run earned partial credit.
 */
export function summarizeResult(input: {
  before: readonly SessionRecord[];
  session: SessionRecord;
  anyPartial: boolean;
  now: Date;
  goal?: number;
}): ResultSummary {
  const { before, session, anyPartial, now, goal = DEFAULT_ROUNDS_GOAL } = input;
  const after = [...before, session];
  const previousBest = bestRungOn(session.script_id, before);
  const newBest = previousBest !== null && session.score > previousBest;
  const completed = session.status === 'completed';
  const masteryBefore = masteryFor(session.script_id, before, now);
  const mastery = masteryFor(session.script_id, after, now);

  const badges: Badge[] = [];
  if (completed && !anyPartial) badges.push('clean_run');
  if (mastery === 'mastered' && masteryBefore !== 'mastered') badges.push('script_mastered');
  if (newBest) badges.push('new_best');

  const rankBefore = rankFor(totalRungs(before));
  const rankAfter = rankFor(totalRungs(after));
  return {
    score: session.score,
    completed,
    previousBest,
    newBest,
    badges: badges.slice(0, 2),
    rounds: roundsToday(after, now, goal),
    streak: shiftStreak(after, now, goal),
    rankBefore,
    rankAfter,
    promoted: rankAfter.index > rankBefore.index,
    mastery,
  };
}

// ─── Choosing a script for "Pimp me" ────────────────────────────────────────

/** Extra weight when the student's last session on a script ended on a miss. */
const LAST_MISSED_BONUS = 2;
const UNSEEN_WEIGHT = 6;
const RECHECK_WEIGHT = 5;
const MASTERED_WEIGHT = 1;

/**
 * How strongly "Pimp me" leans toward a script (wireframe 02, note 2: weighted
 * toward weak spots). Missed and unseen scripts weigh most; mastered ones
 * least. Weights are relative; `pickScript` adds the randomness.
 *
 *   not tried       6
 *   re-check due    5
 *   mastered        1
 *   otherwise       7 − best rung (1–7), +2 if the last session ended on a miss
 */
export function scriptPickWeight(
  scriptId: string,
  sessions: readonly SessionRecord[],
  now: Date,
): number {
  const mastery = masteryFor(scriptId, sessions, now);
  if (mastery === 'not_tried') return UNSEEN_WEIGHT;
  if (mastery === 'recheck_due') return RECHECK_WEIGHT;
  if (mastery === 'mastered') return MASTERED_WEIGHT;
  const best = bestRungOn(scriptId, sessions) ?? 0;
  const last = sessions.filter((s) => s.script_id === scriptId).at(-1);
  return TOP_RUNG + 1 - best + (last?.status === 'missed' ? LAST_MISSED_BONUS : 0);
}

/**
 * Picks a script for one-tap "Pimp me" from `scriptIds` (the rotation's
 * scripts), weighted by `scriptPickWeight` with some randomness. The script
 * just played is skipped when there is another choice. `sessions` are oldest
 * first, as `listFinishedSessions` returns them.
 */
export function pickScript(
  scriptIds: readonly string[],
  sessions: readonly SessionRecord[],
  options: { exclude?: string | undefined; random?: () => number; now?: Date } = {},
): string | null {
  const { exclude, random = Math.random, now = new Date() } = options;
  const pool = scriptIds.length > 1 ? scriptIds.filter((id) => id !== exclude) : scriptIds;
  if (pool.length === 0) return null;
  const weighted = pool.map((id) => ({ id, weight: scriptPickWeight(id, sessions, now) }));
  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = random() * total;
  for (const { id, weight } of weighted) {
    roll -= weight;
    if (roll < 0) return id;
  }
  return weighted.at(-1)?.id ?? null;
}

// ─── Progress screen ────────────────────────────────────────────────────────

export interface ShiftDay {
  day: string;
  sessions: number;
  /** 0 nothing, 1 some sessions, 2 rounds finished, 3 more than the goal. */
  level: 0 | 1 | 2 | 3;
  /** A forgiven day inside the current streak. */
  postCall: boolean;
}

/** The last `days` days, oldest first, for the shifts grid. */
export function shiftGrid(
  sessions: readonly SessionRecord[],
  now: Date,
  goal: number = DEFAULT_ROUNDS_GOAL,
  days = 28,
): ShiftDay[] {
  const perDay = new Map<string, number>();
  for (const s of sessions) perDay.set(endedDay(s), (perDay.get(endedDay(s)) ?? 0) + 1);
  const postCall = new Set(shiftStreak(sessions, now, goal).postCall);
  const today = dayKey(now);
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1);
    const n = perDay.get(day) ?? 0;
    const level = n === 0 ? 0 : n < goal ? 1 : n === goal ? 2 : 3;
    return { day, sessions: n, level, postCall: postCall.has(day) };
  });
}

export interface RotationMastery<R extends string = string> {
  rotation: R;
  mastered: number;
  total: number;
}

/** Mastered scripts per rotation, in order of first appearance. A script can count in several rotations. */
export function masteryByRotation<R extends string>(
  scripts: readonly { id: string; rotation: readonly R[] }[],
  sessions: readonly SessionRecord[],
  now: Date,
): RotationMastery<R>[] {
  const rows = new Map<R, RotationMastery<R>>();
  for (const script of scripts) {
    const mastered = masteryFor(script.id, sessions, now) === 'mastered';
    for (const rotation of script.rotation) {
      const row = rows.get(rotation) ?? { rotation, mastered: 0, total: 0 };
      row.total += 1;
      if (mastered) row.mastered += 1;
      rows.set(rotation, row);
    }
  }
  return [...rows.values()];
}

export interface CollectionTile {
  script_id: string;
  status: MasteryStatus;
  best: number;
}

const COLLECTION_ORDER: Record<MasteryStatus, number> = {
  recheck_due: 0,
  in_progress: 1,
  not_tried: 2,
  mastered: 3,
};

/** Script collection tiles: re-check due first, then in progress, new, mastered. */
export function collectionTiles(
  scriptIds: readonly string[],
  sessions: readonly SessionRecord[],
  now: Date,
): CollectionTile[] {
  return scriptIds
    .map((script_id) => ({
      script_id,
      status: masteryFor(script_id, sessions, now),
      best: bestRungOn(script_id, sessions) ?? 0,
    }))
    .sort((a, b) => COLLECTION_ORDER[a.status] - COLLECTION_ORDER[b.status]);
}

// ─── Usage (pnpm stats) ─────────────────────────────────────────────────────

/** Stage 1 succeeds when the tester uses Rounds this many days in a row (PRODUCT.md). */
export const STAGE1_DAYS_IN_A_ROW = 5;

export interface UsageSummary {
  sessions: number;
  activeDays: number;
  firstDay: string | null;
  lastDay: string | null;
  /** Consecutive days with at least one session, ending today or yesterday. */
  currentRun: number;
  longestRun: number;
  meanRung: number;
  bestRung: number;
  /** Most recent days first: [day, sessions, best rung that day]. */
  recent: { day: string; sessions: number; best: number }[];
}

/** How a student has used Rounds: any session counts as using it that day. */
export function usageSummary(
  sessions: readonly SessionRecord[],
  now: Date,
  recentDays = 14,
): UsageSummary {
  const perDay = new Map<string, { sessions: number; best: number }>();
  for (const s of sessions) {
    const d = perDay.get(endedDay(s)) ?? { sessions: 0, best: 0 };
    perDay.set(endedDay(s), { sessions: d.sessions + 1, best: Math.max(d.best, s.score) });
  }
  const days = [...perDay.keys()].sort();

  let longestRun = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of days) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1;
    longestRun = Math.max(longestRun, run);
    previous = day;
  }

  const today = dayKey(now);
  let currentRun = 0;
  let cursor = perDay.has(today) ? today : addDays(today, -1);
  while (perDay.has(cursor)) {
    currentRun += 1;
    cursor = addDays(cursor, -1);
  }

  const recent = Array.from({ length: recentDays }, (_, i) => {
    const day = addDays(today, -i);
    return { day, ...(perDay.get(day) ?? { sessions: 0, best: 0 }) };
  });

  return {
    sessions: sessions.length,
    activeDays: days.length,
    firstDay: days[0] ?? null,
    lastDay: days.at(-1) ?? null,
    currentRun,
    longestRun,
    meanRung: sessions.length ? totalRungs(sessions) / sessions.length : 0,
    bestRung: sessions.reduce((m, s) => Math.max(m, s.score), 0),
    recent,
  };
}
