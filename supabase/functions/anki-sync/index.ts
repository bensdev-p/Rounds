/**
 * POST /functions/v1/anki-sync   (M3.3) — called by the Anki add-on only.
 * Header `x-rounds-device: <token>` from anki-pair's claim. No Supabase key.
 *
 *   { op: 'pull' } -> { note_ids, actions, tag_note_ids }
 *     The notes linked to scripts the student may see (domain rule 2), the
 *     actions not yet applied, and the notes that should carry #PimpMe::missed
 *     (AnkiHub updates wipe it, so the add-on puts it back every sync).
 *   { op: 'push', cards, applied } -> { ok, cards }
 *     Replaces the student's card statistics and marks applied actions.
 *     Ids and numbers only: the strict schema refuses anything else, such as
 *     card text (domain rule 6). Stats for notes we didn't link are dropped.
 *   { op: 'disconnect' } -> { ok }
 *     Disconnects from the Anki side.
 */
import { AnkiSyncRequestSchema, DeviceTokenSchema, linkedCardStats } from '@rounds/shared';
import { CORS, admin, json, log, readBody, sha256 } from '../_shared/anki/http.ts';

const NOT_CONNECTED =
  'This Anki is not connected to PimpMe. Get a code in PimpMe: Settings → Anki.';

async function linkedNoteIds(): Promise<number[]> {
  const { data, error } = await admin.rpc('anki_linked_notes');
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => Number(row.note_id)))].sort((a, b) => a - b);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (request.method !== 'POST') return json(405, { error: 'POST only' });
  const started = Date.now();

  const token = DeviceTokenSchema.safeParse(request.headers.get('x-rounds-device'));
  if (!token.success) return json(401, { error: NOT_CONNECTED });
  const { data: pairing } = await admin
    .from('anki_pairings')
    .select('user_id')
    .eq('token_hash', await sha256(token.data))
    .maybeSingle();
  if (!pairing) return json(401, { error: NOT_CONNECTED });
  const userId = pairing.user_id;

  const parsed = AnkiSyncRequestSchema.safeParse(await readBody(request));
  if (!parsed.success) {
    log({ event: 'anki-sync', refused: true });
    return json(400, { error: 'PimpMe could not read this sync. Update the add-on.' });
  }
  const body = parsed.data;

  try {
    if (body.op === 'pull') {
      const [noteIds, pending, tagged] = await Promise.all([
        linkedNoteIds(),
        admin
          .from('anki_actions')
          .select('id, kind, note_ids')
          .eq('user_id', userId)
          .is('applied_at', null)
          .order('created_at'),
        admin
          .from('anki_actions')
          .select('note_ids')
          .eq('user_id', userId)
          .eq('kind', 'tag_missed')
          .not('applied_at', 'is', null),
      ]);
      if (pending.error) throw new Error(pending.error.message);
      if (tagged.error) throw new Error(tagged.error.message);
      const actions = (pending.data ?? []).map((a) => ({
        id: a.id,
        kind: a.kind,
        note_ids: a.note_ids.map(Number),
      }));
      const tagNoteIds = [
        ...new Set((tagged.data ?? []).flatMap((a) => a.note_ids.map(Number))),
      ].sort((a, b) => a - b);
      log({ event: 'anki-sync', op: 'pull', actions: actions.length, ms: Date.now() - started });
      return json(200, { note_ids: noteIds, actions, tag_note_ids: tagNoteIds });
    }

    if (body.op === 'push') {
      const { kept, dropped } = linkedCardStats(body.cards, await linkedNoteIds());
      const { error } = await admin.rpc('anki_record_sync', {
        p_user: userId,
        p_cards: kept,
        p_applied: body.applied,
      });
      if (error) throw new Error(error.message);
      log({
        event: 'anki-sync',
        op: 'push',
        cards: kept.length,
        dropped,
        applied: body.applied.length,
        ms: Date.now() - started,
      });
      return json(200, { ok: true, cards: kept.length });
    }

    const { error } = await admin.from('anki_pairings').delete().eq('user_id', userId);
    if (error) throw new Error(error.message);
    log({ event: 'anki-sync', op: 'disconnect' });
    return json(200, { ok: true });
  } catch (e) {
    log({ event: 'anki-sync', op: body.op, error: String(e) });
    return json(500, {
      error: 'PimpMe had a problem with this sync. It will try again next time.',
    });
  }
});
