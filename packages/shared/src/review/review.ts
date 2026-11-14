/**
 * Tonight's review (wireframe 09, review.png). Pure functions over the
 * student's recent misses and sessions; the screen only lays them out.
 *
 * - Missed today: at most 5 rows, one per script, oldest first. The rest roll
 *   to tomorrow (note 1). A miss stays until a later ladder on that script
 *   gets past the rung that was missed, or until it is a week old.
 * - Mix-up: shown only when the same pair was confused 2+ times in 7 days
 *   (note 2). Drills count too: a mix-up in a drill is still a mix-up.
 * - Every word shown comes from the script or the miss card's wording
 *   (domain rule 1); nothing here is generated.
 */
import type { IllnessScript, CompareRow } from '../schemas/illnessScript.ts';
import type { MissTag } from '../schemas/attempt.ts';
import { rungIndex, type Question } from '../schemas/question.ts';
import type { SessionRecord } from '../progress/progression.ts';
import { missLabel } from '../progress/missCard.ts';
import type { PatientLog } from '../schemas/patientLog.ts';
import { logStatus } from '../log/patientLog.ts';

export const MAX_MISSED_ROWS = 5;
export const REVIEW_WINDOW_DAYS = 7;
export const MIX_UP_THRESHOLD = 2;
/** About this long per item: a missed script, the mix-up pair, a patient. */
export const MINUTES_PER_ITEM = 4;

export type SessionKind = 'ladder' | 'drill';

/** One missed attempt, with the question it was on. */
export interface MissRecord {
  attempt_id: string;
  /** The script the question belongs to (in a drill, either of the pair). */
  script_id: string;
  question: Question;
  miss_tag: MissTag;
  matched: readonly string[];
  /** ISO timestamp of the attempt. */
  created_at: string;
  session_kind: SessionKind;
}

/** Local midnight `days - 1` days before `now`: the start of a `days`-day window. */
export function windowStart(now: Date, days: number = REVIEW_WINDOW_DAYS): string {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start.toISOString();
}

const time = (iso: string) => new Date(iso).getTime();

/** A later ladder on the script got past the missed rung. */
function cleared(miss: MissRecord, ladders: readonly SessionRecord[]): boolean {
  const needed = rungIndex(miss.question.rung) + 1;
  return ladders.some(
    (s) =>
      s.script_id === miss.script_id &&
      time(s.ended_at) > time(miss.created_at) &&
      s.score >= needed,
  );
}

export interface MissedRow {
  script_id: string;
  miss: MissRecord;
}

/**
 * The "Missed today" rows: ladder misses from the last week that haven't been
 * cleared, the latest per script, oldest first, at most 5. `rolled` is how
 * many wait for tomorrow.
 */
export function missedRows(
  misses: readonly MissRecord[],
  ladders: readonly SessionRecord[],
  now: Date,
  max: number = MAX_MISSED_ROWS,
): { rows: MissedRow[]; rolled: number } {
  const since = time(windowStart(now));
  const latest = new Map<string, MissRecord>();
  for (const miss of misses) {
    if (miss.session_kind !== 'ladder' || time(miss.created_at) < since) continue;
    const seen = latest.get(miss.script_id);
    if (!seen || time(miss.created_at) > time(seen.created_at)) latest.set(miss.script_id, miss);
  }
  const open = [...latest.values()]
    .filter((miss) => !cleared(miss, ladders))
    .sort((a, b) => time(a.created_at) - time(b.created_at))
    .map((miss) => ({ script_id: miss.script_id, miss }));
  return { rows: open.slice(0, max), rolled: Math.max(0, open.length - max) };
}

/** Longest line under a miss before items are cut ("and 2 more"), so it stays on one line. */
export const MAX_SUBTITLE_CHARS = 40;

/**
 * The line under a missed script. A list question that named some items says
 * which ones were left out ("Missed uremia, salicylates", review.png), cut
 * short to fit one line; everything else uses the miss card's label
 * ("Missed on management").
 */
export function missSubtitle(miss: Pick<MissRecord, 'question' | 'matched'>): string {
  const { question, matched } = miss;
  if (question.kind === 'list' && matched.length > 0) {
    const named = new Set(matched);
    const left = question.accepted_answers.map((a) => a.answer).filter((a) => !named.has(a));
    if (left.length > 0) {
      const line = (count: number) => {
        const shown = `Missed ${left.slice(0, count).join(', ')}`;
        return count < left.length ? `${shown} and ${left.length - count} more` : shown;
      };
      // At least one item; more while the line still fits.
      let count = 1;
      while (count < left.length && line(count + 1).length <= MAX_SUBTITLE_CHARS) count += 1;
      return line(count);
    }
  }
  return missLabel(question.rung);
}

export interface MixUp {
  /** The script asked about in the latest mix-up: the left column. */
  script_id: string;
  /** The script the answer fitted instead: the right column. */
  other_id: string;
  /** Mix-ups between the two, either way round, in the last 7 days. */
  count: number;
}

/** The pair mixed up most this week (2+ times), latest first on ties; null if none. */
export function mixUpPair(misses: readonly MissRecord[], now: Date): MixUp | null {
  const since = time(windowStart(now));
  const pairs = new Map<string, { count: number; last: MissRecord }>();
  for (const miss of misses) {
    if (!miss.miss_tag.startsWith('confused_with:') || time(miss.created_at) < since) continue;
    const other = miss.miss_tag.slice('confused_with:'.length);
    const key = [miss.script_id, other].sort().join('|');
    const seen = pairs.get(key);
    if (!seen) pairs.set(key, { count: 1, last: miss });
    else {
      seen.count += 1;
      if (time(miss.created_at) > time(seen.last.created_at)) seen.last = miss;
    }
  }
  let best: { count: number; last: MissRecord } | null = null;
  for (const pair of pairs.values()) {
    if (pair.count < MIX_UP_THRESHOLD) continue;
    if (
      !best ||
      pair.count > best.count ||
      (pair.count === best.count && time(pair.last.created_at) > time(best.last.created_at))
    ) {
      best = pair;
    }
  }
  if (!best) return null;
  return {
    script_id: best.last.script_id,
    other_id: best.last.miss_tag.slice('confused_with:'.length),
    count: best.count,
  };
}

export function timesThisWeek(count: number): string {
  return `${count} ${count === 1 ? 'time' : 'times'} this week`;
}

export interface ComparisonRow {
  label: string;
  left: CompareRow;
  right: CompareRow;
}

/**
 * The two columns of the mix-up comparison, from each script's link to the
 * other. Null unless both links carry rows with the same labels in the same
 * order (content:check enforces that for real content).
 */
export function comparisonRows(
  left: Pick<IllnessScript, 'id' | 'confused_with'>,
  right: Pick<IllnessScript, 'id' | 'confused_with'>,
): ComparisonRow[] | null {
  const mine = left.confused_with.find((l) => l.script_id === right.id)?.compare;
  const theirs = right.confused_with.find((l) => l.script_id === left.id)?.compare;
  if (!mine || !theirs || mine.length !== theirs.length) return null;
  const rows: ComparisonRow[] = [];
  for (const [i, row] of mine.entries()) {
    const other = theirs[i];
    if (!other || other.label !== row.label) return null;
    rows.push({ label: row.label, left: row, right: other });
  }
  return rows;
}

/**
 * Today's logged patients still to practise: one per script, oldest first,
 * leaving out labels with no script and scripts already pimped today.
 */
export function patientsToPractise(
  logs: readonly PatientLog[],
  sessions: readonly SessionRecord[],
  now: Date,
): (PatientLog & { script_id: string })[] {
  const seen = new Set<string>();
  const out: (PatientLog & { script_id: string })[] = [];
  for (const log of logs) {
    const id = log.script_id;
    if (id === null || seen.has(id)) continue;
    seen.add(id);
    if (logStatus(id, sessions, now).tone === 'signal') out.push({ ...log, script_id: id });
  }
  return out;
}

/** "About 12 minutes": 4 minutes per missed script, mix-up pair and patient. */
export function reviewMinutes(items: number): string {
  const minutes = Math.max(1, items) * MINUTES_PER_ITEM;
  return `About ${minutes} minutes`;
}
