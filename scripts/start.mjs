/**
 * `pnpm start`: everything she needs, in one window.
 *   1. checks Docker Desktop is running,
 *   2. starts the local database (no-op if it's already up),
 *   3. starts the grading server (Claude, if supabase/functions/.env has a key),
 *   4. starts the web app and prints the address for her phone.
 * Ctrl+C stops the grading server and the app; the database keeps running.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { APP_PORT, phoneBanner } from './lan.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
const isWindows = process.platform === 'win32';

function step(text) {
  console.log(`• ${text}`);
}

// 1. Docker Desktop
if (spawnSync('docker info', { stdio: 'ignore', shell: true }).status !== 0) {
  console.error('\nDocker Desktop is not running. Start it, wait for it to say "running", then run `pnpm start` again.\n');
  process.exit(1);
}
step('Docker Desktop is running');

// 2. Database
step('Starting the database (first start can take a minute)...');
const db = spawnSync('pnpm -s db:start', { cwd: repo, stdio: 'ignore', shell: true });
if (db.status !== 0) {
  console.error('\nThe database did not start. Run `pnpm db:start` to see why.\n');
  process.exit(1);
}
step('Database ready');

// 3. Grading server. Its output is prefixed so it's easy to tell apart from the app's.
const envFile = `${repo}supabase/functions/.env`;
const hasKey =
  existsSync(envFile) && /^\s*ANTHROPIC_API_KEY\s*=\s*\S+/m.test(readFileSync(envFile, 'utf8'));
step(
  hasKey
    ? 'Starting the grading server (Claude grades answers the matcher misses)'
    : 'Starting the grading server (no API key in supabase/functions/.env: answers are graded on the device only)',
);
const grading = spawn('pnpm -s functions:serve', { cwd: repo, shell: true });
const prefix = (stream) => {
  let rest = '';
  stream.on('data', (chunk) => {
    const lines = (rest + chunk.toString()).split(/\r?\n/);
    rest = lines.pop() ?? '';
    for (const line of lines) if (line.trim()) console.log(`  [grading] ${line}`);
  });
};
prefix(grading.stdout);
prefix(grading.stderr);

// 4. The app
console.log(phoneBanner());
const app = spawn(`pnpm --filter mobile exec expo start --web --port ${APP_PORT}`, {
  cwd: repo,
  stdio: 'inherit',
  shell: true,
});

/** Stops a child and everything it started (on Windows the shell's children too). */
function stop(child) {
  if (child.exitCode !== null || child.pid === undefined) return;
  if (isWindows) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else child.kill('SIGINT');
}

let stopping = false;
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  stop(app);
  stop(grading);
  console.log('\nStopped the app and the grading server. The database is still running (`supabase stop` to stop it).');
  process.exit(code);
}
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
app.on('exit', (code) => shutdown(code ?? 0));
grading.on('exit', (code) => {
  if (!stopping) console.log(`  [grading] stopped (exit ${code}). Answers are graded on the device until you restart \`pnpm start\`.`);
});
