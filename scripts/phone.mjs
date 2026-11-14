/**
 * `pnpm phone`: start only the web app and print the address to open on a
 * phone on the same Wi-Fi. Needs the database running (`pnpm db:start`).
 * `pnpm start` starts everything at once.
 */
import { spawn } from 'node:child_process';
import { APP_PORT, phoneBanner } from './lan.mjs';

console.log(phoneBanner());

// One fixed command string (no user input), so running it through the shell is safe.
const child = spawn(`pnpm --filter mobile exec expo start --web --port ${APP_PORT}`, {
  stdio: 'inherit',
  shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
