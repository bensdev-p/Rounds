import { describe, expect, it } from 'vitest';
import {
  AnkiCardStatSchema,
  AnkiSyncRequestSchema,
  PAIRING_CODE_ALPHABET,
  ankiConnection,
  codeMinutesLeft,
  lastSyncedLabel,
  linkedCardStats,
  noteIdsForMiss,
  normalisePairingCode,
  pairingCodeFromBytes,
  type AnkiCardStat,
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
