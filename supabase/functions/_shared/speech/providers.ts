/** Picks the speech providers from the environment (supabase/functions/.env). */
import { createDeepgramStt, createDeepgramTts } from './deepgram.ts';
import { createFakeStt, createFakeTts } from './fake.ts';
import type { SttProvider, TtsProvider } from './types.ts';

function env(name: string): string | undefined {
  const value = Deno.env.get(name)?.trim();
  return value ? value : undefined;
}

/** SPEECH_PROVIDER: deepgram (default) | fake. null when no key is set. */
function deepgramKey(fn: string): string | null {
  const key = env('DEEPGRAM_API_KEY');
  if (!key) console.warn(`[${fn}] DEEPGRAM_API_KEY is not set; voice is off`);
  return key ?? null;
}

export function createStt(fn: string): SttProvider | null {
  if (env('SPEECH_PROVIDER') === 'fake') return createFakeStt();
  const key = deepgramKey(fn);
  return key ? createDeepgramStt(key, env('STT_MODEL') ?? 'nova-3') : null;
}

export function createTts(fn: string): TtsProvider | null {
  if (env('SPEECH_PROVIDER') === 'fake') return createFakeTts();
  const key = deepgramKey(fn);
  return key ? createDeepgramTts(key) : null;
}
