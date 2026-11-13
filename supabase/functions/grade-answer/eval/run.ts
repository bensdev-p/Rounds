/**
 * Grading eval: runs eval/cases.json through the same grading step students
 * get (grade.ts), against the scripts in content/scripts, and reports accuracy,
 * latency and cost. Draft scripts are fine here: nothing is shown to students.
 *
 *   pnpm eval:grading --dry-run           free: checks cases, shows which reach the model
 *   pnpm eval:grading                     real calls with GRADER_MODEL (BILLED)
 *   pnpm eval:grading --model claude-haiku-5-5
 *   pnpm eval:grading --only pneumonia    just the matching cases
 *
 * Reads ANTHROPIC_API_KEY from supabase/functions/.env (never printed).
 * Results go to eval/results/ (gitignored).
 */
import { gradeLocally, type Confusable, type Question } from '@rounds/shared';
import { parseContentFile, type ContentFile } from '../../../../packages/shared/src/content/contentFile.ts';
import { createAnthropicProvider, supportsServerFallback } from '../../_shared/llm/anthropic.ts';
import type { LlmUsage } from '../../_shared/llm/types.ts';
import { gradeAnswerStep } from '../grade.ts';

/** US$ per million tokens [input, output]; thinking is billed as output. */
const PRICES: Record<string, [number, number]> = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
};
/** Cache reads cost this share of the input price (Opus/Sonnet 5.5: 0.05, Haiku: 0.1). */
const CACHE_READ_SHARE: Record<string, number> = {
  'claude-opus-5-5': 0.05,
  'claude-sonnet-5-5': 0.05,
  'claude-haiku-5-5': 0.1,
};

interface EvalCase {
  q: string;
  answer: string;
  matched: string[];
  confused?: string;
}

const here = new URL('.', import.meta.url);
const repo = new URL('../../../../', import.meta.url);

function arg(name: string): string | undefined {
  const i = Deno.args.indexOf(name);
  return i >= 0 ? Deno.args[i + 1] : undefined;
}

async function readEnvFile(): Promise<Record<string, string>> {
  try {
    const text = await Deno.readTextFile(new URL('supabase/functions/.env', repo));
    return Object.fromEntries(
      text
        .split(/\r?\n/)
        .map((line) => /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line))
        .filter((m): m is RegExpExecArray => m !== null)
        .map((m) => [m[1]!, m[2]!.replace(/^["']|["']$/g, '')]),
    );
  } catch {
    return {};
  }
}

async function loadContent(): Promise<ContentFile[]> {
  const files: ContentFile[] = [];
  const dir = new URL('content/scripts/', repo);
  for await (const entry of Deno.readDir(dir)) {
    if (!entry.isFile || !entry.name.endsWith('.json')) continue;
    const raw = JSON.parse(await Deno.readTextFile(new URL(entry.name, dir)));
    const { file, problems } = parseContentFile(raw, entry.name.replace(/\.json$/, ''));
    if (!file || problems.length > 0) throw new Error(`${entry.name}: ${problems.join('; ')}`);
    files.push(file);
  }
  return files;
}

function costOf(model: string, usage: LlmUsage | null): number | null {
  const price = PRICES[model.replace(/-\d{8}$/, '')];
  if (!price || !usage) return null;
  const [inPrice, outPrice] = price;
  const cacheShare = CACHE_READ_SHARE[model] ?? 0.1;
  return (
    (usage.input_tokens * inPrice +
      usage.cache_read_input_tokens * inPrice * cacheShare +
      usage.cache_creation_input_tokens * inPrice * 1.25 +
      usage.output_tokens * outPrice) /
    1_000_000
  );
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

const dryRun = Deno.args.includes('--dry-run');
const envFile = await readEnvFile();
const model = arg('--model') ?? envFile.GRADER_MODEL ?? 'claude-opus-5-5';
const effort = (arg('--effort') ?? 'low') as 'low' | 'medium' | 'high';

const only = arg('--only');
const { cases: allCases } = JSON.parse(await Deno.readTextFile(new URL('cases.json', here))) as {
  cases: EvalCase[];
};
// --only <text>: run just the cases whose question id or answer contains it.
const cases = only ? allCases.filter((c) => c.q.includes(only) || c.answer.includes(only)) : allCases;
if (cases.length === 0) {
  console.error(`No eval case matches --only "${only}"`);
  Deno.exit(1);
}
const files = await loadContent();
const byQuestion = new Map<string, { question: Question; file: ContentFile }>();
for (const file of files) for (const question of file.questions) byQuestion.set(question.id, { question, file });
const names = new Map(files.map((f) => [f.script.id, [f.script.name, ...f.script.aliases]]));
const confusablesFor = (file: ContentFile): Confusable[] =>
  file.script.confused_with
    .filter((c) => names.has(c.script_id))
    .map((c) => ({ script_id: c.script_id, names: names.get(c.script_id)! }));

// Check the cases themselves before spending anything.
const caseProblems: string[] = [];
for (const c of cases) {
  const found = byQuestion.get(c.q);
  if (!found) {
    caseProblems.push(`${c.q}: no such question`);
    continue;
  }
  const canonical = found.question.accepted_answers.map((a) => a.answer);
  for (const m of c.matched) if (!canonical.includes(m)) caseProblems.push(`${c.q}: "${m}" is not an accepted answer`);
  const local = gradeLocally(found.question, c.answer, confusablesFor(found.file));
  if (local.grade === 'correct') caseProblems.push(`${c.q}: "${c.answer}" is already matched locally; it won't test the model`);
}
if (caseProblems.length > 0) {
  console.error(`Fix the eval cases first:\n- ${caseProblems.join('\n- ')}`);
  Deno.exit(1);
}

if (dryRun) {
  console.log(`Dry run: ${cases.length} cases are valid and all would go to ${model}. No calls made.`);
  Deno.exit(0);
}

const apiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? envFile.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY is not set in supabase/functions/.env');
  Deno.exit(1);
}
const llm = createAnthropicProvider({
  apiKey,
  model,
  effort,
  timeoutMs: 8_000,
  maxRetries: 1,
  serverFallback: supportsServerFallback(model),
});

interface Row {
  q: string;
  answer: string;
  expected: string[];
  got: string[];
  expectedConfused: string | null;
  gotConfused: string | null;
  ok: boolean;
  outcome: string;
  latency_ms: number;
  usage: LlmUsage | null;
  cost: number | null;
}
const rows: Row[] = [];
for (const c of cases) {
  const { question, file } = byQuestion.get(c.q)!;
  const started = Date.now();
  const step = await gradeAnswerStep({
    question,
    script: file.script,
    confusables: confusablesFor(file),
    answer: c.answer,
    llm,
    deadlineMs: 10_000,
  });
  const got = step.response.result.matched;
  const gotConfused = step.response.result.confused_with_script_id;
  const ok = sameSet(got, c.matched) && gotConfused === (c.confused ?? null);
  rows.push({
    q: c.q,
    answer: c.answer,
    expected: c.matched,
    got,
    expectedConfused: c.confused ?? null,
    gotConfused,
    ok,
    outcome: step.outcome,
    latency_ms: Date.now() - started,
    usage: step.usage,
    cost: costOf(step.model ?? model, step.usage),
  });
  console.log(`${ok ? 'ok  ' : 'MISS'} ${step.outcome.padEnd(16)} ${String(Date.now() - started).padStart(5)} ms  ${c.q}  "${c.answer}"`);
}

const passed = rows.filter((r) => r.ok).length;
const falseCredit = rows.filter((r) => r.got.some((g) => !r.expected.includes(g)));
const missedCredit = rows.filter((r) => r.expected.some((e) => !r.got.includes(e)));
const failures = rows.filter((r) => r.outcome !== 'llm');
const latencies = rows.map((r) => r.latency_ms).sort((a, b) => a - b);
const pct = (p: number) => latencies[Math.min(latencies.length - 1, Math.floor(p * latencies.length))] ?? 0;
const costs = rows.map((r) => r.cost).filter((c): c is number => c !== null);
const totalCost = costs.reduce((a, b) => a + b, 0);
const tokens = rows.reduce(
  (t, r) => ({
    input: t.input + (r.usage?.input_tokens ?? 0),
    output: t.output + (r.usage?.output_tokens ?? 0),
    cacheRead: t.cacheRead + (r.usage?.cache_read_input_tokens ?? 0),
  }),
  { input: 0, output: 0, cacheRead: 0 },
);

const summary = {
  model,
  effort,
  cases: rows.length,
  correct: passed,
  accuracy: passed / rows.length,
  false_credit: falseCredit.length,
  missed_credit: missedCredit.length,
  model_failures: failures.length,
  latency_ms: { p50: pct(0.5), p95: pct(0.95), max: latencies.at(-1) ?? 0 },
  tokens,
  cost_usd: { total: totalCost, per_call: costs.length ? totalCost / costs.length : null },
};
console.log('\n', JSON.stringify(summary, null, 2));
for (const r of rows.filter((r) => !r.ok)) {
  console.log(
    `MISS ${r.q} "${r.answer}": expected [${r.expected.join(', ')}]${r.expectedConfused ? ` confused ${r.expectedConfused}` : ''}, got [${r.got.join(', ')}]${r.gotConfused ? ` confused ${r.gotConfused}` : ''} (${r.outcome})`,
  );
}

const outDir = new URL('results/', here);
await Deno.mkdir(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
await Deno.writeTextFile(
  new URL(`${stamp}-${model}.json`, outDir),
  JSON.stringify({ summary, rows }, null, 2),
);
