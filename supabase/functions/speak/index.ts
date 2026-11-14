/**
 * GET /functions/v1/speak?question_id=…&persona=…&speed=…
 * GET /functions/v1/speak?cue=thinking&persona=…&speed=…
 *   -> raw PCM (16-bit little-endian, mono, 24 kHz; see X-Audio-Format)
 *
 * The attending's voice (M2.5). It only ever speaks a question the caller can
 * see (RLS on `questions`) or one of the fixed cue lines, never free text, so
 * the key can't be used as a general voice service.
 *
 * Audio is cached in the private `voice-cache` bucket, keyed by vendor, voice,
 * speed, question id and a hash of the prompt, so an edited question never
 * plays stale audio. The first ask streams from the vendor while saving a copy.
 *
 * Env (supabase/functions/.env, gitignored):
 *   DEEPGRAM_API_KEY  Without it, voice is off.
 *   SPEECH_PROVIDER   deepgram (default) | fake (tests)
 * Set by Supabase: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import {
  CUES,
  CueIdSchema,
  isVoiceSpeed,
  PERSONAS,
  questionFromRow,
  QuestionIdSchema,
  type Database,
} from '@rounds/shared';
import { z } from 'zod';
import { createTts } from '../_shared/speech/providers.ts';
import { PCM_FORMAT, type PersonaVoice } from '../_shared/speech/types.ts';

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

/** Supabase's edge runtime keeps the worker alive for this after the response. */
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const url = env('SUPABASE_URL');
const anonKey = env('SUPABASE_ANON_KEY');
const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tts = createTts('speak');
const BUCKET = 'voice-cache';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'x-audio-format, x-cache',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const PersonaSchema = z.enum(Object.keys(PERSONAS) as [PersonaVoice, ...PersonaVoice[]]);
const QuerySchema = z
  .object({
    question_id: QuestionIdSchema.optional(),
    cue: CueIdSchema.optional(),
    persona: PersonaSchema,
    speed: z.coerce.number().default(1).refine(isVoiceSpeed),
  })
  .refine((q) => (q.question_id === undefined) !== (q.cue === undefined), {
    message: 'Give question_id or cue',
  });

async function sha(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest).slice(0, 8), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let length = 0;
  for await (const part of stream) {
    parts.push(part);
    length += part.length;
  }
  const all = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.length;
  }
  return all;
}

function audio(body: BodyInit, cache: 'hit' | 'miss'): Response {
  return new Response(body, {
    headers: {
      ...CORS,
      'Content-Type': 'application/octet-stream',
      'X-Audio-Format': PCM_FORMAT,
      'X-Cache': cache,
      'Cache-Control': 'private, max-age=86400',
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'GET') return json(405, { error: 'GET only' });

  const query = QuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return json(400, { error: 'Expected question_id or cue, persona and speed' });
  const { question_id, cue, persona, speed } = query.data;

  const asCaller = createClient<Database>(url, anonKey, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: user, error: userError } = await asCaller.auth.getUser();
  if (userError || !user.user) return json(401, { error: 'Not signed in' });

  // What to say: a question the caller can see, or a fixed cue.
  let text: string;
  let id: string;
  if (question_id) {
    const { data, error } = await asCaller
      .from('questions')
      .select('*')
      .eq('id', question_id)
      .maybeSingle();
    if (error) return json(500, { error: 'Could not load the question' });
    if (!data) return json(404, { error: 'Question not found' });
    try {
      text = questionFromRow(data).prompt;
    } catch {
      return json(404, { error: 'Question not found' });
    }
    id = question_id;
  } else {
    text = CUES[cue!];
    id = `cue.${cue}`;
  }

  if (!tts) return json(503, { error: 'Voice is not set up on this server' });
  const key = `${tts.name}/${tts.voiceFor(persona)}/${speed.toFixed(1)}/${id}-${await sha(text)}.pcm`;

  const cached = await admin.storage.from(BUCKET).download(key);
  if (cached.data) {
    console.log(JSON.stringify({ event: 'speak', id, cache: 'hit' }));
    return audio(await cached.data.arrayBuffer(), 'hit');
  }

  const started = Date.now();
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await tts.synthesize({ text, persona, speed });
  } catch (e) {
    console.error(JSON.stringify({ event: 'speak', id, error: String(e) }));
    return json(502, { error: 'Could not voice the question' });
  }
  const [toClient, toCache] = stream.tee();
  const save = collect(toCache)
    .then((bytes) =>
      admin.storage.from(BUCKET).upload(key, bytes, {
        contentType: 'application/octet-stream',
        upsert: true,
      }),
    )
    .then((result) => {
      if (result.error) throw result.error;
      console.log(
        JSON.stringify({ event: 'speak', id, cache: 'miss', vendor_ms: Date.now() - started }),
      );
    })
    .catch((e) => console.error(JSON.stringify({ event: 'speak', id, cache_error: String(e) })));
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(save);
  return audio(toClient, 'miss');
});
