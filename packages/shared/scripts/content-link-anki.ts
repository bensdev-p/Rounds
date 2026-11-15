/**
 * `pnpm content:link-anki <links.json> [--dry-run]`: brings the AnKing notes
 * the developer confirmed in the Rounds linker add-on into
 * content/scripts/*.json as `anki_refs` (ids and rungs only, domain rule 6).
 * Then run `pnpm content:check` and `pnpm content:seed`.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AnkiLinksFileSchema, applyAnkiLinks } from '../src/content/ankiLinks.ts';
import { checkContent } from '../src/content/contentFile.ts';
import { fail, loadContent, sha256, writeContentFile } from './content.ts';

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith('--'));
const dryRun = args.includes('--dry-run');
if (!path) fail(['Usage: pnpm content:link-anki <links.json> [--dry-run]']);

let raw: unknown;
try {
  raw = JSON.parse(readFileSync(resolve(process.env.INIT_CWD ?? process.cwd(), path), 'utf8'));
} catch (error) {
  fail([`Couldn't read ${path}: ${String(error)}`]);
}
const links = AnkiLinksFileSchema.safeParse(raw);
if (!links.success) {
  fail(links.error.issues.map((i) => `${path}: ${i.path.join('.') || '(file)'}: ${i.message}`));
}

const { files, approvals, problems } = loadContent();
if (problems.length > 0) fail(problems);

const result = applyAnkiLinks(files, links.data);
if (result.problems.length > 0) fail(result.problems);

const byId = new Map(result.changed.map((f) => [f.script.id, f]));
const after = files.map((f) => byId.get(f.script.id) ?? f);
const check = checkContent(after, approvals, sha256);
if (check.length > 0) fail(check);

for (const s of result.summary) {
  console.log(`${s.changed ? 'linked ' : 'same   '} ${s.scriptId}: ${s.before} → ${s.after} notes`);
}
if (dryRun) {
  console.log(`Dry run: ${result.changed.length} script(s) would change. Nothing written.`);
} else {
  for (const f of result.changed) writeContentFile(f);
  console.log(
    `${result.changed.length} script(s) updated. Next: pnpm content:check, pnpm content:seed, pnpm db:reset.`,
  );
}
