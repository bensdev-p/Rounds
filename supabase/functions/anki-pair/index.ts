/**
 * POST /functions/v1/anki-pair   (M3.3, Settings → Anki, wireframe 12 note 1)
 *
 * From the app (Authorization: Bearer <student JWT>; anonymous students count):
 *   { op: 'start' } -> { code: 'ABCD-2345', expires_in: 600 }
 *     A one-time code for the add-on. A new code replaces any pending one; an
 *     existing connection keeps working until the new code is claimed.
 *
 * From the Anki add-on (no JWT; it never holds a Supabase key):
 *   { op: 'claim', code } -> { token }
 *     Trades the code for a device token, once. Claiming replaces the old
 *     connection (one per account). Wrong codes count toward a per-caller limit.
 *
 * Codes and tokens are stored as SHA-256 hashes only.
 */
import {
  AnkiClaimRequestSchema,
  CLAIM_FAILURE_WINDOW_S,
  MAX_CLAIM_FAILURES,
  PAIRING_CODE_TTL_S,
  normalisePairingCode,
  pairingCodeFromBytes,
} from '@rounds/shared';
import {
  CORS,
  admin,
  callerId,
  callerIpHash,
  json,
  log,
  newDeviceToken,
  readBody,
  sha256,
} from '../_shared/anki/http.ts';

const WRONG_CODE = 'That code is wrong or has expired. Get a new one in Rounds: Settings → Anki.';

async function start(request: Request): Promise<Response> {
  const userId = await callerId(request);
  if (!userId) return json(401, { error: 'Not signed in' });
  const code = pairingCodeFromBytes(crypto.getRandomValues(new Uint8Array(8)));
  const { error } = await admin.from('anki_pairings').upsert(
    {
      user_id: userId,
      code_hash: await sha256(code),
      code_expires_at: new Date(Date.now() + PAIRING_CODE_TTL_S * 1000).toISOString(),
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    log({ event: 'anki-pair', op: 'start', error: error.message });
    return json(500, { error: 'Could not make a code' });
  }
  log({ event: 'anki-pair', op: 'start' });
  return json(200, { code, expires_in: PAIRING_CODE_TTL_S });
}

async function claim(request: Request, body: unknown): Promise<Response> {
  const parsed = AnkiClaimRequestSchema.safeParse(body);
  const code = parsed.success ? normalisePairingCode(parsed.data.code) : null;
  if (!code) return json(400, { error: 'Enter the 8-character code from Rounds.' });

  const ipHash = await callerIpHash(request);
  const since = new Date(Date.now() - CLAIM_FAILURE_WINDOW_S * 1000).toISOString();
  const { count } = await admin
    .from('anki_claim_failures')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gt('at', since);
  if ((count ?? 0) >= MAX_CLAIM_FAILURES) {
    log({ event: 'anki-pair', op: 'claim', limited: true });
    return json(429, { error: 'Too many wrong codes. Wait 10 minutes, then try again.' });
  }

  const token = newDeviceToken();
  const codeHash = await sha256(code);
  // One statement: the code is matched, used up and swapped for the token together.
  const { data: claimed, error } = await admin
    .from('anki_pairings')
    .update({
      code_hash: null,
      code_expires_at: null,
      token_hash: await sha256(token),
      claimed_at: new Date().toISOString(),
      last_sync_at: null,
    })
    .eq('code_hash', codeHash)
    .gt('code_expires_at', new Date().toISOString())
    .select('user_id');
  if (error) {
    log({ event: 'anki-pair', op: 'claim', error: error.message });
    return json(500, { error: 'Could not connect. Try again.' });
  }
  if (!claimed?.length) {
    await admin.from('anki_claim_failures').insert({ ip_hash: ipHash });
    // Old failures aren't needed past the window.
    await admin.from('anki_claim_failures').delete().lt('at', since);
    log({ event: 'anki-pair', op: 'claim', ok: false });
    return json(404, { error: WRONG_CODE });
  }
  // A new connection may be a different Anki profile: its card ids differ.
  await admin.from('anki_card_stats').delete().eq('user_id', claimed[0].user_id);
  log({ event: 'anki-pair', op: 'claim', ok: true });
  return json(200, { token });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json(405, { error: 'POST only' });
  const body = await readBody(request);
  const op = (body as { op?: unknown } | null)?.op;
  if (op === 'start') return start(request);
  if (op === 'claim') return claim(request, body);
  return json(400, { error: 'Unknown op' });
});
