import { describe, expect, it } from 'vitest';
import {
  AnkiCardStatSchema,
  AnkiSyncRequestSchema,
  PAIRING_CODE_ALPHABET,
  ankiConnection,
  codeMinutesLeft,
  lastSyncedLabel,
  linkedCardStats,
  linkedNotesOf,
  noteIdsForMiss,
  normalisePairingCode,
  pairingCodeFromBytes,
  resultAnkiRow,
  reviewAnkiLine,
  type AnkiActionRow,
  type AnkiCardStat,
  type AnkiConnection,
} from './anki.ts';

const card: AnkiCardStat = {
  card_id: 1_478_000_000_001,
  note_id: 1_470_000_000_001,
  suspended: true,
  queue: -1,
  due_days: null,
  interval_days: 0,
  reps: 0,
  lapses: 0,
  last_review_ms: null,
};

describe('pairing codes', () => {
  it('makes ABCD-1234 shaped codes from the alphabet only', () => {
    const code = pairingCodeFromBytes(Uint8Array.from([0, 1, 2, 3, 30, 31, 255, 128]));
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(
      code
        .replace('-', '')
        .split('')
        .every((c) => PAIRING_CODE_ALPHABET.includes(c)),
    ).toBe(true);
    expect(PAIRING_CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it('reads codes as people type them', () => {
    expect(normalisePairingCode('abcd-2345')).toBe('ABCD-2345');
    expect(normalisePairingCode(' ABCD 2345 ')).toBe('ABCD-2345');
    expect(normalisePairingCode('ABCD2345')).toBe('ABCD-2345');
  });

  it('refuses what cannot be a code', () => {
    expect(normalisePairingCode('ABCD-234')).toBeNull();
    expect(normalisePairingCode('ABCD-1234')).toBeNull(); // 1 is never used
    expect(normalisePairingCode('ABCD-O234')).toBeNull();
    expect(normalisePairingCode(12345678)).toBeNull();
    expect(normalisePairingCode('A'.repeat(40))).toBeNull();
  });

  it('counts minutes left, rounded up', () => {
    const now = new Date('2026-11-15T20:00:00Z');
    expect(codeMinutesLeft(new Date('2026-11-15T20:09:01Z'), now)).toBe(10);
    expect(codeMinutesLeft(new Date('2026-11-15T20:00:30Z'), now)).toBe(1);
    expect(codeMinutesLeft(new Date('2026-11-15T19:59:00Z'), now)).toBe(0);
  });
});

describe('sync shapes', () => {
  it('accepts a card of ids and numbers', () => {
    expect(AnkiCardStatSchema.safeParse(card).success).toBe(true);
  });

  it('refuses anything extra, such as card text (domain rule 6)', () => {
    expect(AnkiCardStatSchema.safeParse({ ...card, front: 'What causes…' }).success).toBe(false);
    expect(
      AnkiSyncRequestSchema.safeParse({ op: 'push', cards: [], applied: [], fields: ['x'] })
        .success,
    ).toBe(false);
  });

  it('refuses unsafe ids', () => {
    expect(AnkiCardStatSchema.safeParse({ ...card, card_id: 2 ** 60 }).success).toBe(false);
    expect(AnkiCardStatSchema.safeParse({ ...card, note_id: -1 }).success).toBe(false);
  });

  it('keeps stats for linked notes only', () => {
    const other = { ...card, card_id: 2, note_id: 99 };
    expect(linkedCardStats([card, other], [card.note_id])).toEqual({ kept: [card], dropped: 1 });
  });
});

describe('connection state', () => {
  it('is none until a code is claimed', () => {
    expect(ankiConnection(null)).toEqual({ state: 'none' });
    expect(
      ankiConnection({
        code_expires_at: '2026-11-15T20:10:00Z',
        claimed_at: null,
        last_sync_at: null,
      }),
    ).toEqual({ state: 'none' });
  });

  it('is connected once claimed', () => {
    const c = ankiConnection({
      code_expires_at: null,
      claimed_at: '2026-11-15T20:01:00Z',
      last_sync_at: null,
    });
    expect(c.state).toBe('connected');
  });

  it('says when it last synced', () => {
    const now = new Date(2026, 10, 15, 21, 0);
    expect(lastSyncedLabel(null, now)).toBe('Waiting for the first sync');
    expect(lastSyncedLabel(new Date(2026, 10, 15, 20, 14), now)).toBe('Last synced today, 8:14 pm');
    expect(lastSyncedLabel(new Date(2026, 10, 14, 0, 5), now)).toBe(
      'Last synced yesterday, 12:05 am',
    );
    expect(lastSyncedLabel(new Date(2026, 10, 12, 9, 0), now)).toBe('Last synced on 12 Nov');
  });
});

describe('noteIdsForMiss', () => {
  const linked = [
    { script_id: 'a', note_id: 3, rung: 'management' },
    { script_id: 'a', note_id: 2, rung: null },
    { script_id: 'a', note_id: 1, rung: null },
    { script_id: 'b', note_id: 9, rung: 'management' },
  ];

  it("uses the missed rung's notes", () => {
    expect(noteIdsForMiss(linked, 'a', 'management')).toEqual({ rung: 'management', noteIds: [3] });
  });

  it('falls back to the core notes', () => {
    expect(noteIdsForMiss(linked, 'a', 'pearl')).toEqual({ rung: null, noteIds: [1, 2] });
    expect(noteIdsForMiss(linked, 'a', null)).toEqual({ rung: null, noteIds: [1, 2] });
  });

  it('is empty for a script with no links', () => {
    expect(noteIdsForMiss(linked, 'c', 'recall').noteIds).toEqual([]);
  });
});

describe('linkedNotesOf', () => {
  it("reads the script's anki_refs", () => {
    expect(
      linkedNotesOf({
        id: 'a',
        anki_refs: [{ id: '12', rung: 'management' }, { id: '7' }],
      }),
    ).toEqual([
      { script_id: 'a', note_id: 12, rung: 'management' },
      { script_id: 'a', note_id: 7, rung: null },
    ]);
  });
});

const connected: AnkiConnection = {
  state: 'connected',
  claimedAt: new Date(2026, 10, 15, 8),
  lastSyncAt: new Date(2026, 10, 16, 7, 30),
};
const neverSynced: AnkiConnection = { ...connected, lastSyncAt: null };

function action(over: Partial<AnkiActionRow>): AnkiActionRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    kind: 'unsuspend',
    script_id: 'a',
    rung: 'management',
    note_ids: [3],
    created_at: '2026-11-16T08:00:00+00:00',
    applied_at: null,
    applied_count: null,
    ...over,
  };
}

describe('resultAnkiRow', () => {
  const linked = [
    { script_id: 'a', note_id: 3, rung: 'management' },
    { script_id: 'a', note_id: 1, rung: null },
  ];
  const cards = [
    { card_id: 31, note_id: 3, suspended: true },
    { card_id: 32, note_id: 3, suspended: true },
    { card_id: 33, note_id: 3, suspended: false },
    { card_id: 11, note_id: 1, suspended: true },
  ];
  const base = { connection: connected, linked, scriptId: 'a', cards, actions: [] };

  it('counts suspended cards on the missed rung', () => {
    expect(resultAnkiRow({ ...base, missedRung: 'management' })).toEqual({
      kind: 'unsuspend',
      cards: 2,
    });
  });

  it('falls back to the core notes', () => {
    expect(resultAnkiRow({ ...base, missedRung: 'pearl' })).toEqual({
      kind: 'unsuspend',
      cards: 1,
    });
  });

  it('is hidden after a clean run or with no linked notes', () => {
    expect(resultAnkiRow({ ...base, missedRung: null })).toEqual({ kind: 'hidden' });
    expect(resultAnkiRow({ ...base, scriptId: 'b', missedRung: 'recall' })).toEqual({
      kind: 'hidden',
    });
  });

  it('is hidden when none of the cards are suspended', () => {
    const active = cards.map((c) => ({ ...c, suspended: false }));
    expect(resultAnkiRow({ ...base, cards: active, missedRung: 'management' })).toEqual({
      kind: 'hidden',
    });
  });

  it('asks to connect Anki when not connected', () => {
    expect(
      resultAnkiRow({ ...base, connection: { state: 'none' }, missedRung: 'management' }),
    ).toEqual({ kind: 'connect' });
  });

  it("doesn't know the count before the first sync", () => {
    expect(
      resultAnkiRow({ ...base, connection: neverSynced, cards: [], missedRung: 'management' }),
    ).toEqual({ kind: 'unsuspend', cards: null });
  });

  it('shows a pending action for the same script and rung as queued', () => {
    expect(resultAnkiRow({ ...base, actions: [action({})], missedRung: 'management' })).toEqual({
      kind: 'queued',
      cards: 2,
    });
    // Core notes: the action was queued with rung null.
    expect(
      resultAnkiRow({ ...base, actions: [action({ rung: null })], missedRung: 'pearl' }),
    ).toEqual({ kind: 'queued', cards: 1 });
    expect(
      resultAnkiRow({ ...base, actions: [action({ rung: null })], missedRung: 'management' }),
    ).toEqual({ kind: 'unsuspend', cards: 2 });
    expect(
      resultAnkiRow({
        ...base,
        actions: [action({ kind: 'tag_missed' })],
        missedRung: 'management',
      }),
    ).toEqual({ kind: 'unsuspend', cards: 2 });
  });
});

describe('reviewAnkiLine', () => {
  const now = new Date(2026, 10, 16, 20, 0);
  const todayStart = new Date(2026, 10, 16);
  const cards = [
    { card_id: 31, note_id: 3, suspended: true },
    { card_id: 32, note_id: 3, suspended: true },
  ];
  const base = { connection: connected, cards, todayStart, now };

  it('is hidden until Anki is connected', () => {
    expect(reviewAnkiLine({ ...base, connection: { state: 'none' }, actions: [] })).toBeNull();
  });

  it('sums the cards unsuspended today', () => {
    const applied = (count: number, at: Date) =>
      action({ applied_at: at.toISOString(), applied_count: count });
    expect(
      reviewAnkiLine({
        ...base,
        actions: [
          applied(4, new Date(2026, 10, 16, 9)),
          applied(3, new Date(2026, 10, 16, 18)),
          applied(5, new Date(2026, 10, 15, 22)),
          action({ kind: 'tag_missed', applied_at: now.toISOString(), applied_count: 9 }),
        ],
      }),
    ).toBe("7 Anki cards unsuspended today. They'll show up next time you open Anki.");
    expect(reviewAnkiLine({ ...base, actions: [applied(1, new Date(2026, 10, 16, 9))] })).toBe(
      "1 Anki card unsuspended today. It'll show up next time you open Anki.",
    );
  });

  it('counts cards waiting for the next sync', () => {
    expect(reviewAnkiLine({ ...base, actions: [action({})] })).toBe(
      '2 Anki cards will be unsuspended next time Anki opens.',
    );
    expect(
      reviewAnkiLine({ ...base, connection: neverSynced, cards: [], actions: [action({})] }),
    ).toBe('Anki cards will be unsuspended next time Anki opens.');
  });

  it('otherwise says when Anki last synced', () => {
    expect(reviewAnkiLine({ ...base, actions: [] })).toBe(
      'Anki connected. Last synced today, 7:30 am.',
    );
    expect(reviewAnkiLine({ ...base, connection: neverSynced, actions: [] })).toBe(
      'Anki connected. Waiting for the first sync.',
    );
  });
});
