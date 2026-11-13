/**
 * `pnpm content:review [id]`: writes a Markdown review sheet for each script
 * that isn't approved yet (or just the one named) to content/review/.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkContent, renderReviewSheet } from '../src/content/contentFile.ts';
import { CONTENT_DIR, fail, loadContent, sha256 } from './content.ts';

const only = process.argv[2];
const { files, approvals, problems } = loadContent();
const all = [...problems, ...checkContent(files, approvals, sha256)];
if (all.length > 0) fail(all);

const names = new Map(files.map((f) => [f.script.id, f.script.name]));
const chosen = files.filter((f) =>
  only ? f.script.id === only : f.script.status === 'draft' || f.script.status === 'in_review',
);
if (only && chosen.length === 0) fail([`No script with id "${only}"`]);

const dir = join(CONTENT_DIR, 'review');
mkdirSync(dir, { recursive: true });
for (const file of chosen) {
  writeFileSync(join(dir, `${file.script.id}.md`), renderReviewSheet(file, names));
}
console.log(
  chosen.length > 0
    ? `Wrote ${chosen.length} review sheet(s) to ${dir}`
    : 'Nothing waiting for review.',
);
