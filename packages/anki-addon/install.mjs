/**
 * `pnpm anki:addon:install`: copies the Rounds add-on into Anki's add-ons
 * folder on this computer, pointed at the local stack. Restart Anki afterwards.
 * Keeps the installed copy's meta.json (Anki's saved config).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('./rounds_anki/', import.meta.url));

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

const target = join(addons, 'rounds_anki');
mkdirSync(target, { recursive: true });
for (const name of readdirSync(target)) {
  if (name !== 'meta.json') rmSync(join(target, name), { recursive: true, force: true });
}
cpSync(source, target, {
  recursive: true,
  filter: (src) => !/[\/](__pycache__|meta\.json)([\/]|$)/.test(src),
});
console.log(
  `Installed the Rounds add-on to ${target} (server: the local stack). Restart Anki, then Tools → Rounds → Connect to Rounds.`,
);
