/**
 * `pnpm content:approve <id> --by "Name, role"`: records a medical reviewer's
 * approval of the script's exact current text (domain rule 2). Run it only
 * after the reviewer has read the sheet from `pnpm content:review`.
 */
import { approve, checkContent } from '../src/content/contentFile.ts';
import { fail, loadContent, sha256, writeApprovals, writeContentFile } from './content.ts';

const args = process.argv.slice(2);
const id = args[0];
const byIndex = args.indexOf('--by');
const reviewer = byIndex >= 0 ? args[byIndex + 1] : undefined;
if (!id || id.startsWith('--') || !reviewer) {
  fail(['Usage: pnpm content:approve <script-id> --by "Name, role"']);
}

const { files, approvals, problems } = loadContent();
const all = [...problems, ...checkContent(files, approvals, sha256)];
if (all.length > 0) fail(all);

const file = files.find((f) => f.script.id === id);
if (!file) fail([`No script with id "${id}"`]);

try {
  const result = approve(file, approvals, reviewer, new Date(), sha256);
  writeContentFile(result.file);
  writeApprovals(result.approvals);
  console.log(
    `Approved ${id} (v${result.file.script.version}) by ${reviewer}. Next: pnpm content:seed, then pnpm db:reset.`,
  );
} catch (error) {
  fail([error instanceof Error ? error.message : String(error)]);
}
