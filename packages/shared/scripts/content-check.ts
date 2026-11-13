/** `pnpm content:check`: validates every script, drafts included. */
import { checkContent } from '../src/content/contentFile.ts';
import { fail, loadContent, sha256 } from './content.ts';

const { files, approvals, problems } = loadContent();
const all = [...problems, ...checkContent(files, approvals, sha256)];
if (all.length > 0) fail(all);

const count = (status: string) => files.filter((f) => f.script.status === status).length;
console.log(
  `Content OK: ${files.length} scripts (${count('approved')} approved, ${count('in_review')} in review, ${count('draft')} draft).`,
);
