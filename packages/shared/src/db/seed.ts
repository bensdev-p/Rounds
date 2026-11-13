import type { IllnessScript } from '../schemas/illnessScript.ts';
import { traceQuestionToScript, type Question } from '../schemas/question.ts';
import { questionToRow, scriptToRow } from './rows.ts';

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

  const scriptValues = scripts.map((script) => {
    const row = scriptToRow(script);
    return `  (${[
      literal(row.id),
      literal(row.version ?? 1),
      literal(row.status ?? 'draft'),
      literal(row.reviewed_by ?? null),
      literal(row.reviewed_at ?? null),
      jsonb(row.content),
    ].join(', ')})`;
  });

  const questionValues = questions.map((question) => {
    const row = questionToRow(question);
    return `  (${[
      literal(row.id),
      literal(row.script_id),
      literal(row.script_version),
      literal(row.rung),
      jsonb(row.content),
    ].join(', ')})`;
  });

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
