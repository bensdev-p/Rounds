/**
 * `pnpm content:flags`: the review queue. Lists every "This is wrong" flag
 * students have sent, grouped by script and question, newest first.
 *
 * Local only: reads the local Supabase with its service key from
 * `supabase status`, which never leaves this machine or ships in the app.
 */
import { FLAG_REASON_LABELS } from '../src/schemas/flag.ts';
import { localAdminClient } from './localDb.ts';

const db = localAdminClient();

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
