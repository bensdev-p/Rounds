/**
 * The daily pimp's API calls against the local stack (M4.3). Requires
 * `pnpm db:start` with the seed: the fixtures are approved, the real scripts
 * are in review. Signed-out visitors and anonymous users get approved
 * scripts only, even though the local seed turns the app's preview on.
 */
import { createClient } from '@supabase/supabase-js';
import { describe, expect, inject, it } from 'vitest';
import type { Database } from '../db/database.types.ts';
import { isFixtureScript } from '../fixtures/index.ts';
import { getDailyContent, getDailyPool, isTester, type RoundsClient } from './index.ts';

function visitor(): RoundsClient {
  return createClient<Database>(inject('supabaseUrl'), inject('supabaseKey'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

describe('daily pimp', () => {
  it('serves signed-out visitors approved scripts only', async () => {
    const client = visitor();
    const pool = await getDailyPool(client);
    expect(pool.length).toBeGreaterThan(0);
    expect(pool.every(isFixtureScript)).toBe(true);

    const content = await getDailyContent(client, pool[0]!);
    expect(content?.script.status).toBe('approved');
    expect(content?.questions.length).toBeGreaterThan(0);
  });

  it('gives an anonymous user no in-review scripts and no tester access', async () => {
    const client = visitor();
    const { error } = await client.auth.signInAnonymously();
    if (error) throw error;
    expect(await isTester(client)).toBe(false);
    expect((await getDailyPool(client)).every(isFixtureScript)).toBe(true);
    expect(await getDailyContent(client, 'acute-pancreatitis')).toBeNull();
  });
});
