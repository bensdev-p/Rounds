/**
 * `pnpm stats`: is Stage 1 working? For each student on this computer's
 * database: days used, the current run of days in a row (the goal is 5),
 * sessions per day and rungs reached, plus the last 14 days.
 *
 * Students are anonymous; they're shown by the first 8 characters of their id.
 * Accounts with fewer than 3 sessions (mostly automated tests) are hidden; --all shows them.
 */
import { STAGE1_DAYS_IN_A_ROW, usageSummary, type SessionRecord } from '../src/progress/progression.ts';
import { localAdminClient } from './localDb.ts';

const showAll = process.argv.includes('--all');
const db = localAdminClient();
const [sessions, flags] = await Promise.all([
  db.from('ladder_sessions').select('user_id, script_id, score, status, ended_at').neq('status', 'in_progress'),
  db.from('question_flags').select('user_id'),
]);
if (sessions.error || flags.error) {
  console.error(`Could not read usage: ${(sessions.error ?? flags.error)?.message}`);
  process.exit(1);
}

const byUser = new Map<string, SessionRecord[]>();
for (const s of sessions.data ?? []) {
  if (!s.ended_at || s.status === 'in_progress') continue;
  byUser.set(s.user_id, [
    ...(byUser.get(s.user_id) ?? []),
    { script_id: s.script_id, score: s.score, status: s.status, ended_at: s.ended_at },
  ]);
}
const flagCount = new Map<string, number>();
for (const f of flags.data ?? []) flagCount.set(f.user_id, (flagCount.get(f.user_id) ?? 0) + 1);

const now = new Date();
const rows = [...byUser]
  .map(([user, list]) => ({ user, u: usageSummary(list, now) }))
  .filter(({ u }) => showAll || u.sessions >= 3)
  .sort((a, b) => (b.u.lastDay ?? '').localeCompare(a.u.lastDay ?? '') || b.u.sessions - a.u.sessions);

if (rows.length === 0) {
  console.log(showAll ? 'No sessions yet.' : 'No students with 3 or more sessions yet (try --all).');
  process.exit(0);
}

const short = (iso: string | null) =>
  iso ? new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '-';
const hidden = byUser.size - rows.length;

const pad = (v: string | number, n: number) => String(v).padStart(n);
console.log(`5-day goal: ${STAGE1_DAYS_IN_A_ROW} days in a row of using Rounds. Last 14 days: sessions per day, oldest first.
`);
console.log('Student   First   Last    Days  In a row   Sessions  Mean  Best  Flags  Last 14 days');
for (const { user, u } of rows) {
  const run =
    u.longestRun >= STAGE1_DAYS_IN_A_ROW ? `MET (${u.longestRun})` : `${u.currentRun} of ${STAGE1_DAYS_IN_A_ROW}`;
  const strip = [...u.recent]
    .reverse()
    .map((d) => (d.sessions === 0 ? '·' : d.sessions > 9 ? '+' : String(d.sessions)))
    .join('');
  console.log(
    `${user.slice(0, 8)}  ${short(u.firstDay).padEnd(6)}  ${short(u.lastDay).padEnd(6)}  ${pad(u.activeDays, 4)}  ${run.padEnd(9)}  ${pad(u.sessions, 8)}  ${pad(u.meanRung.toFixed(1), 4)}  ${pad(u.bestRung, 4)}  ${pad(flagCount.get(user) ?? 0, 5)}  ${strip}`,
  );
}
if (hidden > 0) console.log(`
(${hidden} account(s) with fewer than 3 sessions hidden; --all to show)`);
