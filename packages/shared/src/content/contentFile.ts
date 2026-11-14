/**
 * Real illness-script content (content/scripts/<id>.json). Pure functions, so
 * they can be tested without the file system; the CLI in scripts/ does the I/O.
 *
 * Flow (CLAUDE.md domain rules 1 and 2):
 *   draft → reviewer reads the review sheet → `content:approve` records who
 *   approved which exact text → only approved scripts are seeded.
 * An approval is tied to a hash of the script and its questions, so editing
 * approved content fails `content:check` until it is reviewed again.
 */
import { z } from 'zod';
import { validateContent } from '../db/seed.ts';
import {
  IllnessScriptSchema,
  ScriptIdSchema,
  type IllnessScript,
} from '../schemas/illnessScript.ts';
import { collectStrings, resolveFieldPath } from '../schemas/fieldPath.ts';
import { QuestionSchema, RUNGS, type Question } from '../schemas/question.ts';

export interface ContentFile {
  script: IllnessScript;
  questions: Question[];
}

/** Hashes a string (SHA-256 hex in the CLI). Injected so this module stays pure. */
export type HashFn = (text: string) => string;

const RawFileSchema = z.strictObject({
  script: z.unknown(),
  questions: z.array(z.record(z.string(), z.unknown())),
});

const issues = (error: z.ZodError, prefix: string): string[] =>
  error.issues.map((i) => `${prefix}${i.path.length ? `.${i.path.join('.')}` : ''}: ${i.message}`);

/**
 * Parses one content file. Questions omit `script_id` and `script_version`;
 * they come from the script. Each rung needs exactly one question, because the
 * score is the rung reached.
 */
export function parseContentFile(
  raw: unknown,
  fileId: string,
): { file: ContentFile | null; problems: string[] } {
  const shape = RawFileSchema.safeParse(raw);
  if (!shape.success) return { file: null, problems: issues(shape.error, fileId) };

  const script = IllnessScriptSchema.safeParse(shape.data.script);
  if (!script.success) return { file: null, problems: issues(script.error, `${fileId}.script`) };

  const problems: string[] = [];
  if (script.data.id !== fileId) {
    problems.push(`${fileId}: file name must match script id "${script.data.id}"`);
  }

  const questions: Question[] = [];
  shape.data.questions.forEach((rawQuestion, i) => {
    const parsed = QuestionSchema.safeParse({
      ...rawQuestion,
      script_id: script.data.id,
      script_version: script.data.version,
    });
    if (!parsed.success) {
      problems.push(...issues(parsed.error, `${fileId}.questions[${i}]`));
      return;
    }
    if (!parsed.data.id.startsWith(`${script.data.id}.`)) {
      problems.push(`${parsed.data.id}: question ids must start with "${script.data.id}."`);
    }
    questions.push(parsed.data);
  });

  for (const rung of RUNGS) {
    const count = questions.filter((q) => q.rung === rung).length;
    if (count !== 1) problems.push(`${fileId}: needs exactly one ${rung} question (has ${count})`);
  }

  return { file: { script: script.data, questions }, problems };
}

// ─── Approvals ──────────────────────────────────────────────────────────────

export const ApprovalSchema = z.strictObject({
  version: z.number().int().positive(),
  hash: z.string().regex(/^[0-9a-f]{64}$/),
  reviewed_by: z.string().trim().min(1).max(64),
  reviewed_at: z.iso.datetime({ offset: true }),
});
export type Approval = z.infer<typeof ApprovalSchema>;

export const ApprovalsSchema = z.record(ScriptIdSchema, ApprovalSchema);
export type Approvals = z.infer<typeof ApprovalsSchema>;

/** JSON with keys sorted at every level, so the same content always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

/** The reviewed text: everything except the review metadata itself. */
export function approvalHash(file: ContentFile, hash: HashFn): string {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropping review fields
  const { status, reviewed_by, reviewed_at, ...content } = file.script;
  return hash(canonicalJson({ script: content, questions: file.questions }));
}

/** Every approved script must match the text its reviewer approved. */
export function checkApprovals(
  files: readonly ContentFile[],
  approvals: Approvals,
  hash: HashFn,
): string[] {
  const problems: string[] = [];
  const ids = new Set(files.map((f) => f.script.id));
  for (const file of files) {
    const { script } = file;
    if (script.status !== 'approved') continue;
    const approval = approvals[script.id];
    if (!approval) {
      problems.push(`${script.id}: approved, but no approval is recorded. Use content:approve.`);
      continue;
    }
    if (
      approval.version !== script.version ||
      approval.reviewed_by !== script.reviewed_by ||
      approval.reviewed_at !== script.reviewed_at
    ) {
      problems.push(`${script.id}: review fields don't match the recorded approval.`);
    }
    if (approval.hash !== approvalHash(file, hash)) {
      problems.push(
        `${script.id}: edited after approval. Set status to "in_review", bump version and have it reviewed again.`,
      );
    }
  }
  for (const id of Object.keys(approvals)) {
    if (!ids.has(id)) problems.push(`approvals.json: ${id} has no script file`);
  }
  return problems;
}

/** Records a reviewer's approval of the file's exact text. */
export function approve(
  file: ContentFile,
  approvals: Approvals,
  reviewer: string,
  now: Date,
  hash: HashFn,
): { file: ContentFile; approvals: Approvals } {
  const reviewed_by = reviewer.trim();
  if (!reviewed_by || reviewed_by.length > 64) {
    throw new Error('Reviewer must be 1–64 characters, e.g. "Dr. J. Patel, PGY-3"');
  }
  if (file.script.status === 'approved') throw new Error(`${file.script.id} is already approved`);
  if (file.script.status === 'retired') throw new Error(`${file.script.id} is retired`);

  const reviewed_at = now.toISOString();
  const script = IllnessScriptSchema.parse({
    ...file.script,
    status: 'approved',
    reviewed_by,
    reviewed_at,
  });
  const next = { script, questions: file.questions };
  return {
    file: next,
    approvals: {
      ...approvals,
      [script.id]: { version: script.version, hash: approvalHash(next, hash), reviewed_by, reviewed_at },
    },
  };
}

// ─── Checking and seeding ───────────────────────────────────────────────────

/** Problems across all files, drafts included: links, tracing, approvals. */
export function checkContent(
  files: readonly ContentFile[],
  approvals: Approvals,
  hash: HashFn,
): string[] {
  return [
    ...validateContent(
      files.map((f) => f.script),
      files.flatMap((f) => f.questions),
    ),
    ...checkApprovals(files, approvals, hash),
  ];
}

/**
 * Scripts to seed: approved ones, plus `in_review` ones for the local preview
 * (the database only shows those when `show_in_review` is on). Drafts never
 * leave the repo. Links to unseeded scripts stay in place (questions may cite
 * them by index); the app only shows links to scripts the student can see.
 */
export function seedable(files: readonly ContentFile[]): {
  scripts: IllnessScript[];
  questions: Question[];
  /** Every script id in the repo: valid link targets even if not seeded yet. */
  linkTargets: Set<string>;
} {
  const seeded = files.filter(
    (f) => f.script.status === 'approved' || f.script.status === 'in_review',
  );
  return {
    scripts: seeded.map((f) => f.script),
    questions: seeded.flatMap((f) => f.questions),
    linkTargets: new Set(files.map((f) => f.script.id)),
  };
}

// ─── Review sheet ───────────────────────────────────────────────────────────

const bullets = (items: readonly string[]): string =>
  items.length > 0 ? items.map((i) => `- ${i}`).join('\n') : '- _(none)_';

/** A Markdown sheet a medical reviewer can read top to bottom. */
export function renderReviewSheet(file: ContentFile, names: ReadonlyMap<string, string>): string {
  const s = file.script;
  const lines: string[] = [
    `# ${s.name}`,
    '',
    `Status: **${s.status}**, version ${s.version}. Rotations: ${s.rotation.join(', ')}.` +
      (s.aliases.length > 0 ? ` Also called: ${s.aliases.join(', ')}.` : ''),
    '',
    '> Check every fact against current guidance. Students are only ever graded against',
    '> the accepted answers below, so a missing synonym means a right answer is marked wrong.',
    '',
    '## Who gets it',
    s.epidemiology.who,
    '',
    'Risk factors:',
    bullets(s.epidemiology.risk_factors),
    '',
    '## Pathophysiology',
    s.pathophysiology,
    '',
    '## Timeline',
    `Onset: ${s.timeline.onset}. Course: ${s.timeline.course}.`,
    '',
    '## Key findings',
    '**History**',
    bullets(s.key_findings.history),
    '',
    '**Exam**',
    bullets(s.key_findings.exam),
    '',
    '**Labs**',
    bullets(s.key_findings.labs),
    '',
    '**Imaging**',
    bullets(s.key_findings.imaging),
    '',
    '## Diagnosis',
    '**Confirmatory tests**',
    bullets(s.diagnosis.confirmatory_tests),
    '',
    '**Criteria**',
    bullets(s.diagnosis.criteria),
    '',
    '## Management',
    '**First line**',
    bullets(s.management.first_line),
    '',
    '**Next line**',
    bullets(s.management.next_line),
    '',
    '## Complications',
    bullets(s.complications),
    '',
    '## Confused with',
    bullets(
      s.confused_with.map(
        (c) => `**${names.get(c.script_id) ?? c.script_id}**: ${c.how_to_tell_apart}`,
      ),
    ),
    '',
    '## Pearls',
    bullets(s.pearls),
    '',
    '## Sources',
    bullets(s.sources.map((src) => (src.url ? `[${src.title}](${src.url})` : src.title))),
    '',
    '## Questions (the ladder, bottom to top)',
  ];

  file.questions.forEach((q, i) => {
    const source = q.source_fields
      .map((path) => `\`${path}\`: ${collectStrings(resolveFieldPath(s, path)).join('; ')}`)
      .join('<br>');
    lines.push(
      '',
      `### ${i + 1}. ${q.rung.replace('_', ' ')}${q.kind === 'list' ? ` (list: name ${q.required_count})` : ''}`,
      '',
      `**Q:** ${q.prompt}`,
      '',
      '| Accepted answer | Also accepted |',
      '|---|---|',
      ...q.accepted_answers.map(
        (a) => `| ${a.answer} | ${a.synonyms.length > 0 ? a.synonyms.join(', ') : '_(none)_'} |`,
      ),
      '',
      `Comes from: ${source}`,
    );
  });

  lines.push(
    '',
    '---',
    '',
    'If everything above is correct:',
    '',
    '```bash',
    `pnpm content:approve ${s.id} --by "Your name, role"`,
    '```',
    '',
  );
  return lines.join('\n');
}
