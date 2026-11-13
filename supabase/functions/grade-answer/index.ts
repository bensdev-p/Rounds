/**
 * POST /functions/v1/grade-answer  { question_id, answer }
 *   -> { result, grader, grader_version }
 *
 * Grades one answer against its approved illness script. Tries the local
 * matcher first; only if that misses does it ask the model, and any model
 * failure falls back to the local grade. See handler.ts.
 *
 * Env (supabase/functions/.env, gitignored):
 *   ANTHROPIC_API_KEY  required for real grading; without it, grading is local only
 *   LLM_PROVIDER       anthropic (default) | fake (tests) | none
 *   GRADER_MODEL       default claude-opus-5-5
 */
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@rounds/shared';
import { createAnthropicProvider } from '../_shared/llm/anthropic.ts';
import type { LlmProvider } from '../_shared/llm/types.ts';
import { createFakeGrader } from './fakeGrader.ts';
import { createHandler } from './handler.ts';

function env(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

function createLlm(): LlmProvider | null {
  const provider = env('LLM_PROVIDER') ?? 'anthropic';
  if (provider === 'fake') return createFakeGrader();
  if (provider === 'none') return null;
  const apiKey = env('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.warn('[grade-answer] ANTHROPIC_API_KEY is not set; grading locally only');
    return null;
  }
  return createAnthropicProvider({
    apiKey,
    model: env('GRADER_MODEL') ?? 'claude-opus-5-5',
    effort: 'low',
    timeoutMs: 8_000,
    maxRetries: 1,
  });
}

const supabaseUrl = env('SUPABASE_URL');
const supabaseKey = env('SUPABASE_ANON_KEY');
if (!supabaseUrl || !supabaseKey) throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');

Deno.serve(
  createHandler({
    llm: createLlm(),
    dbFor: (request) =>
      createClient<Database>(supabaseUrl, supabaseKey, {
        global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    // Under the client's 13 s timeout (GRADE_TIMEOUT_MS), so the local fallback always arrives.
    llmDeadlineMs: 10_000,
    log: (entry) => console.log(JSON.stringify({ event: 'grade', ...entry })),
  }),
);
