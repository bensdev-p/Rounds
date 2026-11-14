/**
 * `pnpm content:flags`: the review queue. Lists every "This is wrong" flag
 * students have sent, grouped by script and question, newest first.
 *
 * Local only: reads the local Supabase with its service key from
 * `supabase status`, which never leaves this machine or ships in the app.
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/db/database.types.ts';
import { FLAG_REASON_LABELS } from '../src/schemas/flag.ts';

const repo = fileURLToPath(new URL('../../../', import.meta.url));

function localSupabase(): { url: string; key: string } {
  let out: string;
  try {
    out = execSync('pnpm exec supabase status -o env', { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    console.error('Local Supabase is not running. Start it with `pnpm db:start`.');
    process.exit(1);
  }
  const env = Object.fromEntries(
    out
      .split(/\r?\n/)
      .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  const url = env.API_URL;
  const key = env.SERVICE_ROLE_KEY ?? env.SECRET_KEY;
  if (!url || !key) {
    console.error('Could not read the local Supabase URL and service key from `supabase status`.');
    process.exit(1);
  }
  return { url, key };
}

const { url, key } = localSupabase();
const db = createClient<Database>(url, key, { auth: { persistSession: false } });

const [flags, questions, scripts] = await Promise.all([
  db.from('question_flags').select('*').order('created_at', { ascending: false }),
  db.from('questions').select('id, content'),
  db.from('illness_scripts').select('id, content'),
]);
for (const r of [flags, questions, scripts]) {
  if (r.error) {
    console.error(`Could not read flags: ${r.error.message}`);
    process.exit(1);
  }
}

const rows = flags.data ?? [];
if (rows.length === 0) {
  console.log('No flags yet.');
  process.exit(0);
}

const field = (content: unknown, name: string): string | undefined => {
  const value = (content as Record<string, unknown> | null)?.[name];
  return typeof value === 'string' ? value : undefined;
};
const promptOf = new Map((questions.data ?? []).map((q) => [q.id, field(q.content, 'prompt')]));
const nameOf = new Map((scripts.data ?? []).map((s) => [s.id, field(s.content, 'name') ?? s.id]));
const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const byScript = new Map<string, typeof rows>();
for (const f of rows) byScript.set(f.script_id, [...(byScript.get(f.script_id) ?? []), f]);

console.log(`${rows.length} flag(s) across ${byScript.size} script(s)\n`);
for (const [scriptId, list] of byScript) {
  console.log(`${nameOf.get(scriptId) ?? scriptId} (${scriptId}): ${list.length}`);
  const byQuestion = new Map<string, typeof rows>();
  for (const f of list) {
    const k = f.question_id ?? '(whole script)';
    byQuestion.set(k, [...(byQuestion.get(k) ?? []), f]);
  }
  for (const [questionId, qFlags] of byQuestion) {
    const prompt = promptOf.get(questionId);
    console.log(`  ${questionId}${prompt ? `  "${prompt}"` : ''}`);
    for (const f of qFlags) {
      console.log(
        `    - ${FLAG_REASON_LABELS[f.reason]} (v${f.script_version}, ${day(f.created_at)})${f.note ? `: "${f.note}"` : ''}`,
      );
    }
  }
  console.log('');
}
