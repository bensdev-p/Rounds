// Builds the student Anki add-on for the hosted project (rounds-dev) and copies it
// to public/pimpme.ankiaddon, so the Anki page can offer it for download.
// The file is gitignored: it is rebuilt from packages/anki-addon on every site build.
import { execFileSync } from 'node:child_process';
import { copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = join(dirname(fileURLToPath(import.meta.url)), '..');
const repo = join(site, '..', '..');
const python = process.platform === 'win32' ? 'python' : 'python3';

execFileSync(python, [join(repo, 'packages', 'anki-addon', 'build.py'), '--hosted'], {
  stdio: 'inherit',
});
copyFileSync(
  join(repo, 'packages', 'anki-addon', 'dist', 'rounds-dev.ankiaddon'),
  join(site, 'public', 'pimpme.ankiaddon'),
);
console.log('Copied to apps/site/public/pimpme.ankiaddon');
