/**
 * Validates the real content in content/scripts on every `pnpm test`, so a
 * broken script or an edit to approved text fails CI, not just content:check.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { gradeLocally } from '../grading/localGrader.ts';
import { ApprovalsSchema, checkContent, parseContentFile, type ContentFile } from './contentFile.ts';

const root = fileURLToPath(new URL('../../../../content/', import.meta.url));
const scriptsDir = join(root, 'scripts');
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

function loadFiles(): { files: ContentFile[]; problems: string[] } {
  const names = existsSync(scriptsDir)
    ? readdirSync(scriptsDir).filter((n) => n.endsWith('.json'))
    : [];
  const files: ContentFile[] = [];
  const problems: string[] = [];
  for (const name of names) {
    const parsed = parseContentFile(
      JSON.parse(readFileSync(join(scriptsDir, name), 'utf8')),
      basename(name, '.json'),
    );
    problems.push(...parsed.problems);
    if (parsed.file) files.push(parsed.file);
  }
  return { files, problems };
}

describe('content/scripts', () => {
  it('every accepted answer and synonym earns credit from the local grader', () => {
    const misses: string[] = [];
    for (const { questions } of loadFiles().files) {
      for (const question of questions) {
        for (const accepted of question.accepted_answers) {
          for (const term of [accepted.answer, ...accepted.synonyms]) {
            const result = gradeLocally(question, term, []);
            if (!result.matched.includes(accepted.answer)) {
              misses.push(`${question.id}: "${term}" did not match "${accepted.answer}"`);
            }
          }
        }
      }
    }
    expect(misses).toEqual([]);
  });

  it('every script parses, traces and matches its approval', () => {
    const { files, problems } = loadFiles();
    const approvalsPath = join(root, 'approvals.json');
    const approvals = existsSync(approvalsPath)
      ? ApprovalsSchema.parse(JSON.parse(readFileSync(approvalsPath, 'utf8')))
      : {};
    problems.push(...checkContent(files, approvals, sha256));
    expect(problems).toEqual([]);
  });
});
