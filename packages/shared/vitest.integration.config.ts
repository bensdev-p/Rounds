import { defineConfig } from 'vitest/config';

// Runs against the local Supabase stack (`pnpm db:start`). Not part of `pnpm test`.
export default defineConfig({
  test: {
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['./src/test/supabaseEnv.ts'],
    testTimeout: 20_000,
    fileParallelism: false,
  },
});
