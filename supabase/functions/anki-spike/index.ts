/**
 * M3.1 SPIKE ONLY (branch m3.1-anki-spike, never merged, never deployed).
 *
 * POST /functions/v1/anki-spike  { op, ... }
 *
 * From the app (signed-in student, Authorization: Bearer <user JWT>):
 *   start   -> { code, expires_in }         one-time pairing code, 10 min
 *   queue   { kind, card_ids } -> { id }     queue an unsuspend or tag action
 *   status  -> { pairing, stats, actions }   what the add-on has sent
 *
 * From the add-on (no user JWT; it never holds a Supabase key):
 *   claim   { code } -> { token }            trade the code for a device token
 *   sync    { cards, applied } with header x-rounds-device: <token>
 *           -> { actions }                   upload stats, receive pending actions
 *
 * Codes and tokens are stored as SHA-256 hashes. Ids and numbers only.
 */
import { createClient } from '@supabase/supabase-js';

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} must be set`);
  return value;
}

const url = env('SUPABASE_URL');
const anonKey = env('SUPABASE_ANON_KEY');
const admin = createClient(url, env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CODE_TTL_S = 600;
// No 0/O/1/I/L: the code is read off a phone and typed on a PC.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-rounds-device',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

function normaliseCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const chars = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return chars.length === 8 ? `${chars.slice(0, 4)}-${chars.slice(4)}` : null;
}

async function callerId(request: Request): Promise<string | null> {
  const asCaller = createClient(url, anonKey, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await asCaller.auth.getUser();
  return error || !data.user ? null : data.user.id;
}

type CardStat = {
  card_id: number;
  note_id: number;
  note_guid: string;
  suspended: boolean;
  queue: number;
  due_days: number | null;
  interval_days: number;
  reps: number;
  lapses: number;
  last_review_ms: number | null;
};

function isCardStat(value: unknown): value is CardStat {
  const c = value as Record<string, unknown>;
  return (
    typeof c === 'object' &&
    c !== null &&
    Number.isSafeInteger(c.card_id) &&
    Number.isSafeInteger(c.note_id) &&
    typeof c.note_guid === 'string' &&
    c.note_guid.length <= 32 &&
    typeof c.suspended === 'boolean' &&
    Number.isInteger(c.queue) &&
    Number.isInteger(c.interval_days) &&
    Number.isInteger(c.reps) &&
    Number.isInteger(c.lapses) &&
    // Strict shape: anything extra (like card text) is refused.
    Object.keys(c).every((k) =>
      [
        'card_id',
        'note_id',
        'note_guid',
        'suspended',
        'queue',
        'due_days',
        'interval_days',
        'reps',
        'lapses',
        'last_review_ms',
      ].includes(k),
    )
  );
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json(405, { error: 'POST only' });
  const started = Date.now();
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const op = body.op;

  if (op === 'claim') {
    const code = normaliseCode(body.code);
    if (!code) return json(400, { error: 'Enter the 8-character code from the Rounds app' });
    const { data: rows } = await admin
      .from('anki_spike_pairings')
      .select('id')
      .eq('code_hash', await sha256(code))
      .is('claimed_at', null)
      .gt('code_expires_at', new Date().toISOString())
      .limit(1);
    if (!rows?.length) return json(404, { error: 'That code is wrong or has expired' });
    const token = crypto.randomUUID() + crypto.randomUUID();
    await admin
      .from('anki_spike_pairings')
      .update({ token_hash: await sha256(token), claimed_at: new Date().toISOString() })
      .eq('id', rows[0].id);
    console.log(JSON.stringify({ event: 'anki-spike', op, ms: Date.now() - started }));
    return json(200, { token });
  }

  if (op === 'sync') {
    const token = request.headers.get('x-rounds-device') ?? '';
    const { data: pairing } = await admin
      .from('anki_spike_pairings')
      .select('id, user_id')
      .eq('token_hash', await sha256(token))
      .maybeSingle();
    if (!pairing) return json(401, { error: 'This Anki is not connected' });
    const cards = Array.isArray(body.cards) ? body.cards : [];
    if (!cards.every(isCardStat)) return json(400, { error: 'Bad card stats' });
    if (cards.length) {
      const { error } = await admin.from('anki_spike_card_stats').upsert(
        cards.map((c) => ({
          user_id: pairing.user_id,
          card_id: c.card_id,
          note_id: c.note_id,
          note_guid: c.note_guid,
          suspended: c.suspended,
          queue: c.queue,
          due_days: c.due_days,
          interval_days: c.interval_days,
          reps: c.reps,
          lapses: c.lapses,
          last_review_at: c.last_review_ms ? new Date(c.last_review_ms).toISOString() : null,
          uploaded_at: new Date().toISOString(),
        })),
      );
      if (error) return json(500, { error: error.message });
    }
    const applied = Array.isArray(body.applied) ? body.applied : [];
    for (const a of applied as { id: string; count: number }[]) {
      await admin
        .from('anki_spike_actions')
        .update({ applied_at: new Date().toISOString(), applied_count: a.count })
        .eq('id', a.id)
        .eq('user_id', pairing.user_id);
    }
    await admin
      .from('anki_spike_pairings')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', pairing.id);
    const { data: actions } = await admin
      .from('anki_spike_actions')
      .select('id, kind, card_ids')
      .eq('user_id', pairing.user_id)
      .is('applied_at', null)
      .order('created_at');
    console.log(
      JSON.stringify({
        event: 'anki-spike',
        op,
        cards: cards.length,
        bytes: Number(request.headers.get('content-length') ?? 0),
        ms: Date.now() - started,
      }),
    );
    return json(200, { actions: actions ?? [] });
  }

  const userId = await callerId(request);
  if (!userId) return json(401, { error: 'Not signed in' });

  if (op === 'start') {
    const code = randomCode();
    await admin.from('anki_spike_pairings').insert({
      user_id: userId,
      code_hash: await sha256(code),
      code_expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString(),
    });
    return json(200, { code, expires_in: CODE_TTL_S });
  }

  if (op === 'queue') {
    const kind = body.kind;
    const ids = body.card_ids;
    if ((kind !== 'unsuspend' && kind !== 'tag_missed') || !Array.isArray(ids)) {
      return json(400, { error: 'kind and card_ids needed' });
    }
    if (!ids.every((id) => Number.isSafeInteger(id))) return json(400, { error: 'Bad card ids' });
    const { data, error } = await admin
      .from('anki_spike_actions')
      .insert({ user_id: userId, kind, card_ids: ids })
      .select('id')
      .single();
    if (error) return json(500, { error: error.message });
    return json(200, { id: data.id });
  }

  if (op === 'status') {
    const [pairings, stats, actions] = await Promise.all([
      admin
        .from('anki_spike_pairings')
        .select('claimed_at, last_sync_at')
        .eq('user_id', userId)
        .not('claimed_at', 'is', null)
        .order('claimed_at', { ascending: false })
        .limit(1),
      admin
        .from('anki_spike_card_stats')
        .select('card_id, note_id, suspended, lapses')
        .eq('user_id', userId)
        .order('card_id')
        .limit(200),
      admin
        .from('anki_spike_actions')
        .select('id, kind, card_ids, created_at, applied_at, applied_count')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    return json(200, {
      pairing: pairings.data?.[0] ?? null,
      stats: stats.data ?? [],
      actions: actions.data ?? [],
    });
  }

  return json(400, { error: 'Unknown op' });
});
