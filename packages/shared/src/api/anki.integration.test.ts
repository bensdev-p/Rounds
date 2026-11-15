/**
 * The Anki bridge against the local stack (M3.3): the app gets a code, the
 * add-on claims it, pulls linked notes and actions, pushes card stats, and
 * the app sees the connection; wrong codes, extra fields and disconnecting.
 * Requires `pnpm db:start` and `pnpm functions:serve` (or :fake).
 */
import { createClient } from '@supabase/supabase-js';
import { describe, expect, inject, it } from 'vitest';
import {
  AnkiClaimResponseSchema,
  AnkiPullResponseSchema,
  MAX_CLAIM_FAILURES,
  type AnkiCardStat,
} from '../anki/anki.ts';
import type { Database } from '../db/database.types.ts';
import {
  disconnectAnki,
  getAnkiPairing,
  queueAnkiAction,
  startAnkiPairing,
  type RoundsClient,
} from './index.ts';

async function newStudent(): Promise<RoundsClient> {
  const client = createClient<Database>(inject('supabaseUrl'), inject('supabaseKey'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return client;
}

/** A made-up caller address per test, so runs don't share the wrong-code limit. */
function fakeIp(): string {
  return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
}

/** As the add-on: plain HTTP, no Supabase key. */
async function addOn(
  fn: 'anki-pair' | 'anki-sync',
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; json: unknown }> {
  const response = await fetch(`${inject('supabaseUrl')}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  return { status: response.status, json: await response.json() };
}

async function pair(student: RoundsClient): Promise<string> {
  const { code } = await startAnkiPairing(student);
  const claim = await addOn(
    'anki-pair',
    { op: 'claim', code: code.toLowerCase() },
    {
      'x-forwarded-for': fakeIp(),
    },
  );
  expect(claim.status).toBe(200);
  return AnkiClaimResponseSchema.parse(claim.json).token;
}

function card(noteId: number, cardId: number): AnkiCardStat {
  return {
    card_id: cardId,
    note_id: noteId,
    suspended: true,
    queue: -1,
    due_days: null,
    interval_days: 0,
    reps: 0,
    lapses: 0,
    last_review_ms: null,
  };
}

describe('Anki pairing and sync', () => {
  it('pairs with a one-time code and syncs', async () => {
    const student = await newStudent();
    expect(await getAnkiPairing(student)).toBeNull();

    const token = await pair(student);
    const device = { 'x-rounds-device': token };
    let pairing = await getAnkiPairing(student);
    expect(pairing?.claimed_at).not.toBeNull();
    expect(pairing?.last_sync_at).toBeNull();

    const actionId = await queueAnkiAction(student, {
      script_id: 'acute-pancreatitis',
      rung: 'management',
      kind: 'unsuspend',
    });
    expect(actionId).not.toBeNull();

    const pull = await addOn('anki-sync', { op: 'pull' }, device);
    expect(pull.status).toBe(200);
    const plan = AnkiPullResponseSchema.parse(pull.json);
    expect(plan.note_ids.length).toBeGreaterThan(0);
    expect(plan.actions).toHaveLength(1);
    const action = plan.actions[0]!;
    expect(action.id).toBe(actionId);
    expect(action.note_ids.every((id) => plan.note_ids.includes(id))).toBe(true);

    const linked = action.note_ids[0]!;
    const push = await addOn(
      'anki-sync',
      {
        op: 'push',
        cards: [card(linked, 1), card(1, 2)],
        applied: [{ id: action.id, count: 1 }],
      },
      device,
    );
    expect(push.status).toBe(200);
    expect(push.json).toEqual({ ok: true, cards: 1 });

    const { data: stats } = await student.from('anki_card_stats').select('card_id, note_id');
    expect(stats).toEqual([{ card_id: 1, note_id: linked }]);
    const { data: actions } = await student.from('anki_actions').select('applied_count');
    expect(actions).toEqual([{ applied_count: 1 }]);
    pairing = await getAnkiPairing(student);
    expect(pairing?.last_sync_at).not.toBeNull();

    const again = AnkiPullResponseSchema.parse(
      (await addOn('anki-sync', { op: 'pull' }, device)).json,
    );
    expect(again.actions).toHaveLength(0);
  });

  it('uses each code once', async () => {
    const student = await newStudent();
    const { code } = await startAnkiPairing(student);
    const ip = { 'x-forwarded-for': fakeIp() };
    expect((await addOn('anki-pair', { op: 'claim', code }, ip)).status).toBe(200);
    expect((await addOn('anki-pair', { op: 'claim', code }, ip)).status).toBe(404);
  });

  it('refuses card text and other extra fields', async () => {
    const token = await pair(await newStudent());
    const response = await addOn(
      'anki-sync',
      { op: 'push', cards: [{ ...card(1, 1), front: 'Some card text' }], applied: [] },
      { 'x-rounds-device': token },
    );
    expect(response.status).toBe(400);
  });

  it('refuses unknown devices', async () => {
    const response = await addOn(
      'anki-sync',
      { op: 'pull' },
      { 'x-rounds-device': 'f'.repeat(64) },
    );
    expect(response.status).toBe(401);
  });

  it('stops working once disconnected from the app', async () => {
    const student = await newStudent();
    const token = await pair(student);
    await disconnectAnki(student);
    expect(await getAnkiPairing(student)).toBeNull();
    const response = await addOn('anki-sync', { op: 'pull' }, { 'x-rounds-device': token });
    expect(response.status).toBe(401);
  });

  it('can be disconnected from Anki', async () => {
    const student = await newStudent();
    const token = await pair(student);
    const response = await addOn('anki-sync', { op: 'disconnect' }, { 'x-rounds-device': token });
    expect(response.status).toBe(200);
    expect(await getAnkiPairing(student)).toBeNull();
  });

  it('pairing again replaces the old connection', async () => {
    const student = await newStudent();
    const first = await pair(student);
    const second = await pair(student);
    expect((await addOn('anki-sync', { op: 'pull' }, { 'x-rounds-device': first })).status).toBe(
      401,
    );
    expect((await addOn('anki-sync', { op: 'pull' }, { 'x-rounds-device': second })).status).toBe(
      200,
    );
  });

  it('limits wrong codes per caller', async () => {
    const ip = { 'x-forwarded-for': fakeIp() };
    for (let i = 0; i < MAX_CLAIM_FAILURES; i++) {
      expect((await addOn('anki-pair', { op: 'claim', code: 'ZZZZ-ZZZZ' }, ip)).status).toBe(404);
    }
    expect((await addOn('anki-pair', { op: 'claim', code: 'ZZZZ-ZZZZ' }, ip)).status).toBe(429);
  });

  it('needs a signed-in student to make a code', async () => {
    const response = await addOn('anki-pair', { op: 'start' });
    expect(response.status).toBe(401);
  });
});
