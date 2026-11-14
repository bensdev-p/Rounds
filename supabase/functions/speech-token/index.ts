/**
 * POST /functions/v1/speech-token
 *   -> { vendor, token, expires_in, model }
 *
 * A short-lived speech-to-text token, so the app streams the microphone
 * straight to the vendor while the API key stays here (M2.5). Signed-in
 * students only (anonymous students count: every student has a user).
 *
 * Env (supabase/functions/.env, gitignored):
 *   DEEPGRAM_API_KEY  Member role, needed to grant tokens. Without it, voice is off.
 *   SPEECH_PROVIDER   deepgram (default) | fake (tests)
 *   STT_MODEL         default nova-3
 */
import { createClient } from '@supabase/supabase-js';
import { createStt } from '../_shared/speech/providers.ts';

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

const url = env('SUPABASE_URL');
const anonKey = env('SUPABASE_ANON_KEY');
const stt = createStt('speech-token');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json(405, { error: 'POST only' });

  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await asCaller.auth.getUser();
  if (error || !data.user) return json(401, { error: 'Not signed in' });

  if (!stt) return json(503, { error: 'Voice is not set up on this server' });
  const started = Date.now();
  try {
    const token = await stt.issueStreamingToken();
    console.log(
      JSON.stringify({ event: 'speech-token', vendor: stt.name, latency_ms: Date.now() - started }),
    );
    return json(200, token);
  } catch (e) {
    console.error(JSON.stringify({ event: 'speech-token', error: String(e) }));
    return json(502, { error: 'Could not get a speech token' });
  }
});
