/**
 * Vitest global setup for integration tests: reads the local Supabase URL and
 * publishable key from `supabase status`, so nothing is hard-coded.
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    supabaseUrl: string;
    supabaseKey: string;
  }
}

const repoRoot = fileURLToPath(new URL('../../../../', import.meta.url));

export default function setup(project: TestProject) {
  let raw: string;
  try {
    raw = execSync('pnpm exec supabase status -o json', {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    throw new Error('Local Supabase is not running. Start it with `pnpm db:start`.');
  }

  const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
  const status = JSON.parse(json) as Record<string, string | undefined>;
  const url = status.API_URL;
  const key = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
  if (!url || !key) throw new Error('`supabase status` did not report API_URL and a public key');

  project.provide('supabaseUrl', url);
  project.provide('supabaseKey', key);
}
