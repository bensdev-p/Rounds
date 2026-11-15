import type { IllnessScript } from '../schemas/illnessScript.ts';
import { traceQuestionToScript, type Question } from '../schemas/question.ts';
import { questionToRow, scriptToRow } from './rows.ts';

import { isFixtureScript } from '../fixtures/index.ts';

export class SeedError extends Error {
  override name = 'SeedError';
}

function literal(value: string | number | null): string {
  if (value === null) return 'null';
  if (typeof value === 'number') return String(value);
  return `'${value.replaceAll("'", "''")}'`;
}

function jsonb(value: unknown): string {
  return `${literal(JSON.stringify(value))}::jsonb`;
}

function scriptValuesRow(script: IllnessScript): string {
  const row = scriptToRow(script);
  return `  (${[
    literal(row.id),
    literal(row.version ?? 1),
    literal(row.status ?? 'draft'),
    literal(row.reviewed_by ?? null),
    literal(row.reviewed_at ?? null),
    jsonb(row.content),
  ].join(', ')})`;
}

function questionValuesRow(question: Question): string {
  const row = questionToRow(question);
  return `  (${[
    literal(row.id),
    literal(row.script_id),
    literal(row.script_version),
    literal(row.rung),
    jsonb(row.content),
  ].join(', ')})`;
}

/** Every reason the content can't be seeded. Empty means it's safe. */
export function validateContent(
  scripts: readonly IllnessScript[],
  questions: readonly Question[],
  /** Ids a `confused_with` link may point at. Defaults to `scripts`. */
  linkTargets: ReadonlySet<string> = new Set(scripts.map((s) => s.id)),
): string[] {
  const problems: string[] = [];
  const byId = new Map(scripts.map((s) => [s.id, s]));

  if (byId.size !== scripts.length) problems.push('Duplicate script ids');
  if (new Set(questions.map((q) => q.id)).size !== questions.length) {
    problems.push('Duplicate question ids');
  }

  for (const script of scripts) {
    for (const link of script.confused_with) {
      if (!linkTargets.has(link.script_id)) {
        problems.push(`${script.id}: confused_with links to unknown script ${link.script_id}`);
      }
      // Comparison rows line up only if the link back has the same labels.
      const other = byId.get(link.script_id);
      if (!link.compare || !other) continue;
      const back = other.confused_with.find((l) => l.script_id === script.id);
      const mine = link.compare.map((r) => r.label).join(' | ');
      const theirs = back?.compare?.map((r) => r.label).join(' | ');
      if (mine !== theirs) {
        problems.push(
          `${script.id}: compare rows with ${other.id} need the same labels on ${other.id}'s link back (${mine} vs ${theirs ?? 'none'})`,
        );
      }
    }
  }

  for (const question of questions) {
    const script = byId.get(question.script_id);
    if (!script) {
      problems.push(`${question.id}: unknown script ${question.script_id}`);
      continue;
    }
    for (const issue of traceQuestionToScript(question, script)) {
      problems.push(`${question.id}.${issue.path}: ${issue.message}`);
    }
  }
  return problems;
}

/**
 * Builds `supabase/seed.sql` from validated content. Throws if any question
 * doesn't trace to its script (domain rule 1).
 */
export function buildSeedSql(
  scripts: readonly IllnessScript[],
  questions: readonly Question[],
  header: string,
  linkTargets?: ReadonlySet<string>,
): string {
  const problems = validateContent(scripts, questions, linkTargets);
  if (problems.length > 0) {
    throw new SeedError(`Content failed validation:\n- ${problems.join('\n- ')}`);
  }

  const scriptValues = scripts.map(scriptValuesRow);
  const questionValues = questions.map(questionValuesRow);

  const lines = [...header.split('\n').map((line) => `-- ${line}`.trimEnd()), ''];
  if (scriptValues.length > 0) {
    lines.push(
      'insert into public.illness_scripts (id, version, status, reviewed_by, reviewed_at, content) values',
      `${scriptValues.join(',\n')};`,
      '',
    );
  }
  if (questionValues.length > 0) {
    lines.push(
      'insert into public.questions (id, script_id, script_version, rung, content) values',
      `${questionValues.join(',\n')};`,
      '',
    );
  }
  return lines.join('\n');
}

export interface ContentSqlOptions {
  /**
   * Also show `in_review` scripts, labelled "Not yet reviewed". Only for the
   * private dev project (domain rule 2); false turns the preview off.
   */
  preview: boolean;
}

/**
 * SQL that brings a hosted project's content in line with the repo
 * (`pnpm content:push`). Unlike the seed it updates rows that already exist,
 * never carries the test fixtures, and sets the preview switch explicitly.
 * Scripts the repo no longer seeds (back to draft, or removed) are retired, so
 * students stop seeing them while their history keeps pointing at real rows.
 * Questions are never deleted: attempts refer to them.
 */
export function buildContentSql(
  scripts: readonly IllnessScript[],
  questions: readonly Question[],
  header: string,
  options: ContentSqlOptions,
  linkTargets?: ReadonlySet<string>,
): string {
  const fixtures = [...scripts.map((s) => s.id), ...questions.map((q) => q.script_id)].filter(
    isFixtureScript,
  );
  if (fixtures.length > 0) {
    throw new SeedError(
      `Test fixtures never go to a hosted project: ${[...new Set(fixtures)].join(', ')}`,
    );
  }
  const unseedable = scripts.filter((s) => s.status !== 'approved' && s.status !== 'in_review');
  if (unseedable.length > 0) {
    throw new SeedError(
      `Only approved and in-review scripts are pushed: ${unseedable.map((s) => `${s.id} (${s.status})`).join(', ')}`,
    );
  }
  const problems = validateContent(scripts, questions, linkTargets);
  if (problems.length > 0) {
    throw new SeedError(`Content failed validation:\n- ${problems.join('\n- ')}`);
  }

  // One `do` block: `supabase db query` runs a single statement, and the block
  // is all-or-nothing, so a failed push leaves the project as it was.
  const lines: string[] = [];
  if (scripts.length > 0) {
    lines.push(
      'insert into public.illness_scripts (id, version, status, reviewed_by, reviewed_at, content) values',
      scripts.map(scriptValuesRow).join(',\n'),
      'on conflict (id) do update set',
      '  version = excluded.version, status = excluded.status, reviewed_by = excluded.reviewed_by,',
      '  reviewed_at = excluded.reviewed_at, content = excluded.content;',
      '',
    );
  }
  const kept = scripts.map((s) => literal(s.id));
  lines.push(
    "update public.illness_scripts set status = 'retired'",
    `  where status <> 'retired'${kept.length > 0 ? ` and id not in (${kept.join(', ')})` : ''};`,
    '',
  );
  if (questions.length > 0) {
    lines.push(
      'insert into public.questions (id, script_id, script_version, rung, content) values',
      questions.map(questionValuesRow).join(',\n'),
      'on conflict (id) do update set',
      '  script_id = excluded.script_id, script_version = excluded.script_version,',
      '  rung = excluded.rung, content = excluded.content;',
      '',
    );
  }
  lines.push(
    `insert into public.app_settings (key, value) values ('show_in_review', ${options.preview})`,
    '  on conflict (key) do update set value = excluded.value;',
  );
  const body = lines.join('\n');
  if (body.includes(PUSH_QUOTE)) {
    throw new SeedError(`Content contains ${PUSH_QUOTE}, which the push uses as its quote`);
  }
  return [
    ...header.split('\n').map((line) => `-- ${line}`.trimEnd()),
    '',
    `do ${PUSH_QUOTE}`,
    'begin',
    body,
    `end ${PUSH_QUOTE};`,
    '',
  ].join('\n');
}

const PUSH_QUOTE = '$push$';
