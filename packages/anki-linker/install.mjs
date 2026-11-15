/**
 * `pnpm anki:linker:install`: copies the Rounds linker add-on into Anki's
 * add-ons folder and points it at this repo. Restart Anki afterwards.
 * Keeps the installed copy's user_files (saved links) and meta.json (config).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('./rounds_linker/', import.meta.url));
const repo = fileURLToPath(new URL('../../', import.meta.url)).replace(/[\/]$/, '');

const ankiBase =
  process.env.ANKI_BASE ??
  (platform() === 'win32'
    ? join(process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'), 'Anki2')
    : platform() === 'darwin'
      ? join(homedir(), 'Library', 'Application Support', 'Anki2')
      : join(homedir(), '.local', 'share', 'Anki2'));
const addons = join(ankiBase, 'addons21');
if (!existsSync(addons)) {
  console.error(`No Anki add-ons folder at ${addons}. Open Anki once, or set ANKI_BASE.`);
  process.exit(1);
}

const target = join(addons, 'rounds_linker');
const keep = new Set(['user_files', 'meta.json']);
mkdirSync(target, { recursive: true });
for (const name of readdirSync(target)) {
  if (!keep.has(name)) rmSync(join(target, name), { recursive: true, force: true });
}
cpSync(source, target, {
  recursive: true,
  filter: (src) => !/[\/](__pycache__|user_files|meta\.json)([\/]|$)/.test(src),
});
writeFileSync(join(target, 'config.json'), `${JSON.stringify({ repo_path: repo }, null, 2)}\n`);
console.log(`Installed the Rounds linker to ${target}. Restart Anki, then Tools → Rounds: link scripts.`);
