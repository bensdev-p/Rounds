/**
 * Admin access to the LOCAL Supabase for developer reports (content:flags,
 * stats). Uses the service key from `supabase status`, which never leaves
 * this machine and never ships in the app.
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/db/database.types.ts';

const repo = fileURLToPath(new URL('../../../', import.meta.url));

function localSupabase(): { url: string; key: string } {
  let out: string;
  try {
    out = execSync('pnpm exec supabase status -o env', { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    console.error('Local Supabase is not running. Start it with `pnpm db:start`.');
    process.exit(1);
  }
  const env = Object.fromEntries(
    out
      .split(/\r?\n/)
      .map((line) => /^([A-Z_]+)="?(.*?)"?$/.exec(line))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => [m[1], m[2]]),
  );
  const url = env.API_URL;
  const key = env.SERVICE_ROLE_KEY ?? env.SECRET_KEY;
  if (!url || !key) {
    console.error('Could not read the local Supabase URL and service key from `supabase status`.');
    process.exit(1);
  }
  return { url, key };
}


export function localAdminClient() {
  const { url, key } = localSupabase();
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}
