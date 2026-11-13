/**
 * File I/O for content/ (see src/content/contentFile.ts for the rules).
 * content/scripts/<id>.json holds one script and its questions;
 * content/approvals.json records who approved which exact text.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ApprovalsSchema,
  parseContentFile,
  type Approvals,
  type ContentFile,
  type HashFn,
} from '../src/content/contentFile.ts';

export const CONTENT_DIR = fileURLToPath(new URL('../../../content/', import.meta.url));
export const SCRIPTS_DIR = join(CONTENT_DIR, 'scripts');
export const APPROVALS_FILE = join(CONTENT_DIR, 'approvals.json');

export const sha256: HashFn = (text) => createHash('sha256').update(text).digest('hex');

export interface LoadedContent {
  files: ContentFile[];
  approvals: Approvals;
  problems: string[];
}

export function loadContent(): LoadedContent {
  const problems: string[] = [];
  const files: ContentFile[] = [];
  const names = existsSync(SCRIPTS_DIR)
    ? readdirSync(SCRIPTS_DIR)
        .filter((n) => n.endsWith('.json'))
        .sort()
    : [];
  for (const name of names) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(SCRIPTS_DIR, name), 'utf8'));
    } catch (error) {
      problems.push(`${name}: not valid JSON (${String(error)})`);
      continue;
    }
    const parsed = parseContentFile(raw, basename(name, '.json'));
    problems.push(...parsed.problems);
    if (parsed.file) files.push(parsed.file);
  }

  let approvals: Approvals = {};
  if (existsSync(APPROVALS_FILE)) {
    const parsed = ApprovalsSchema.safeParse(JSON.parse(readFileSync(APPROVALS_FILE, 'utf8')));
    if (parsed.success) approvals = parsed.data;
    else problems.push(`approvals.json: ${parsed.error.message}`);
  }
  return { files, approvals, problems };
}

/** Writes a content file back in the same layout (questions without script_id/version). */
export function writeContentFile(file: ContentFile): void {
  const questions = file.questions.map((q) => {
    const copy: Record<string, unknown> = { ...q };
    delete copy.script_id;
    delete copy.script_version;
    return copy;
  });
  writeFileSync(
    join(SCRIPTS_DIR, `${file.script.id}.json`),
    `${JSON.stringify({ script: file.script, questions }, null, 2)}\n`,
  );
}

export function writeApprovals(approvals: Approvals): void {
  const sorted = Object.fromEntries(
    Object.entries(approvals).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeFileSync(APPROVALS_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
}

export function fail(problems: readonly string[]): never {
  console.error(`Content has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  process.exit(1);
}
