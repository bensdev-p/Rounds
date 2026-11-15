/**
 * The Anki bridge (M3.3): pairing codes and the shapes the add-on and the
 * `anki-pair` / `anki-sync` Edge Functions exchange. Ids and numbers only:
 * every shape is strict, so anything extra (card text) is refused (domain
 * rule 6).
 */
import { z } from 'zod';
import { RungSchema } from '../schemas/rung.ts';
import { ScriptIdSchema } from '../schemas/illnessScript.ts';

// ─── Pairing codes ──────────────────────────────────────────────────────────

/** No 0/O/1/I/L: the code is read off a phone and typed on a computer. */
export const PAIRING_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const PAIRING_CODE_LENGTH = 8;
/** A code works for 10 minutes, once. */
export const PAIRING_CODE_TTL_S = 600;
/** Wrong codes allowed per caller in the window before claims are refused. */
export const MAX_CLAIM_FAILURES = 10;
export const CLAIM_FAILURE_WINDOW_S = 600;

/** "ABCD-1234" from 8 random bytes. Uses only PAIRING_CODE_ALPHABET. */
export function pairingCodeFromBytes(bytes: Uint8Array): string {
  if (bytes.length < PAIRING_CODE_LENGTH) throw new Error('Need 8 random bytes');
  // A slight modulo bias (256 % 31) doesn't matter: the code lives 10 minutes, once.
  const chars = Array.from(
    bytes.slice(0, PAIRING_CODE_LENGTH),
    (b) => PAIRING_CODE_ALPHABET[b % PAIRING_CODE_ALPHABET.length],
  ).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

/**
 * The code as typed ("abcd 1234", "ABCD-1234") in its stored form, or null
 * when it can't be one.
 */
export function normalisePairingCode(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length > 32) return null;
  const chars = raw.toUpperCase().replace(/[\s-]/g, '');
  if (chars.length !== PAIRING_CODE_LENGTH) return null;
  if ([...chars].some((c) => !PAIRING_CODE_ALPHABET.includes(c))) return null;
  return `${chars.slice(0, 4)}-${chars.slice(4)}`;
}

// ─── Ids ────────────────────────────────────────────────────────────────────

/** Anki card and note ids: millisecond timestamps, safe as JSON numbers. */
export const AnkiIdSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/** A device token: 64 hex characters, sent by the add-on in `x-rounds-device`. */
export const DeviceTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

// ─── Sync ───────────────────────────────────────────────────────────────────

/** More cards than 30 scripts' links could ever reach; refuses whole-collection uploads. */
export const MAX_SYNC_CARDS = 5000;

/** One card of a linked note, as the add-on reads it from its collection. */
export const AnkiCardStatSchema = z.strictObject({
  card_id: AnkiIdSchema,
  note_id: AnkiIdSchema,
  suspended: z.boolean(),
  /** Anki's queue: -3..-1 buried/suspended, 0 new, 1 learning, 2 review, 3 day learning, 4 preview. */
  queue: z.number().int().min(-3).max(4),
  /** Days until due, for review cards; null otherwise. */
  due_days: z.number().int().nullable(),
  interval_days: z.number().int().min(0),
  reps: z.number().int().min(0),
  lapses: z.number().int().min(0),
  /** Last review (revlog id, epoch ms), or null when never reviewed. */
  last_review_ms: AnkiIdSchema.nullable(),
});
export type AnkiCardStat = z.infer<typeof AnkiCardStatSchema>;

export const ANKI_ACTION_KINDS = ['unsuspend', 'tag_missed'] as const;
export const AnkiActionKindSchema = z.enum(ANKI_ACTION_KINDS);
export type AnkiActionKind = z.infer<typeof AnkiActionKindSchema>;

/** A queued change, as sent to the add-on. */
export const AnkiActionSchema = z.strictObject({
  id: z.uuid(),
  kind: AnkiActionKindSchema,
  note_ids: z.array(AnkiIdSchema).min(1),
});
export type AnkiAction = z.infer<typeof AnkiActionSchema>;

/** What the add-on did with one action: cards unsuspended or notes tagged. */
export const AnkiAppliedSchema = z.strictObject({
  id: z.uuid(),
  count: z.number().int().min(0),
});
export type AnkiApplied = z.infer<typeof AnkiAppliedSchema>;

export const AnkiClaimRequestSchema = z.strictObject({
  op: z.literal('claim'),
  code: z.string().max(32),
});

export const AnkiClaimResponseSchema = z.strictObject({ token: DeviceTokenSchema });

export const AnkiPullResponseSchema = z.strictObject({
  /** Every note linked to a script the student may see. */
  note_ids: z.array(AnkiIdSchema),
  /** Actions not yet applied, oldest first. */
  actions: z.array(AnkiActionSchema),
  /** Notes that should carry #Rounds::missed (AnkiHub updates wipe it). */
  tag_note_ids: z.array(AnkiIdSchema),
});
export type AnkiPullResponse = z.infer<typeof AnkiPullResponseSchema>;

export const AnkiSyncRequestSchema = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('pull') }),
  z.strictObject({
    op: z.literal('push'),
    cards: z.array(AnkiCardStatSchema).max(MAX_SYNC_CARDS),
    applied: z.array(AnkiAppliedSchema).max(200),
  }),
  z.strictObject({ op: z.literal('disconnect') }),
]);
export type AnkiSyncRequest = z.infer<typeof AnkiSyncRequestSchema>;

/**
 * Keeps only stats for notes Rounds linked; reports whether any were dropped.
 * The add-on only reads linked notes, so a drop means an old or wrong client.
 */
export function linkedCardStats(
  cards: readonly AnkiCardStat[],
  linkedNoteIds: Iterable<number>,
): { kept: AnkiCardStat[]; dropped: number } {
  const linked = new Set(linkedNoteIds);
  const kept = cards.filter((c) => linked.has(c.note_id));
  return { kept, dropped: cards.length - kept.length };
}

// ─── In the app ─────────────────────────────────────────────────────────────

/** The student's own pairing row, as the app may read it. */
export const AnkiPairingSchema = z.strictObject({
  code_expires_at: z.iso.datetime({ offset: true }).nullable(),
  claimed_at: z.iso.datetime({ offset: true }).nullable(),
  last_sync_at: z.iso.datetime({ offset: true }).nullable(),
});
export type AnkiPairing = z.infer<typeof AnkiPairingSchema>;

export type AnkiConnection =
  { state: 'none' } | { state: 'connected'; claimedAt: Date; lastSyncAt: Date | null };

export function ankiConnection(pairing: AnkiPairing | null): AnkiConnection {
  if (!pairing?.claimed_at) return { state: 'none' };
  return {
    state: 'connected',
    claimedAt: new Date(pairing.claimed_at),
    lastSyncAt: pairing.last_sync_at ? new Date(pairing.last_sync_at) : null,
  };
}

export const AnkiPairingCodeSchema = z.strictObject({
  code: z.string().regex(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/),
  expires_in: z.number().int().positive(),
});
export type AnkiPairingCode = z.infer<typeof AnkiPairingCodeSchema>;

/** Minutes left on a code, rounded up; 0 once it has expired. */
export function codeMinutesLeft(expiresAt: Date, now: Date): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 60_000));
}

function clock(date: Date): string {
  const h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h % 12 === 0 ? 12 : h % 12}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

function dayStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * "Last synced today, 8:14 pm", "yesterday, 7:02 am", "on 12 Nov", or
 * "Waiting for the first sync". Local time.
 */
export function lastSyncedLabel(lastSyncAt: Date | null, now: Date): string {
  if (!lastSyncAt) return 'Waiting for the first sync';
  const days = Math.round((dayStart(now) - dayStart(lastSyncAt)) / 86_400_000);
  if (days <= 0) return `Last synced today, ${clock(lastSyncAt)}`;
  if (days === 1) return `Last synced yesterday, ${clock(lastSyncAt)}`;
  const month = lastSyncAt.toLocaleString('en-GB', { month: 'short' });
  return `Last synced on ${lastSyncAt.getDate()} ${month}`;
}

/** A script and rung to queue an action for (M3.4's result screen, `pnpm anki:queue`). */
export const QueueAnkiActionSchema = z.strictObject({
  script_id: ScriptIdSchema,
  rung: RungSchema.nullable(),
  kind: AnkiActionKindSchema,
});
export type QueueAnkiAction = z.infer<typeof QueueAnkiActionSchema>;

/** One linked note, as `anki_linked_notes()` returns it. */
export interface LinkedNote {
  script_id: string;
  note_id: number;
  rung: string | null;
}

/**
 * The notes a miss on `rung` points to: that rung's linked notes, or the
 * script's core notes when the rung has none. Mirrors `queue_anki_action`.
 */
export function noteIdsForMiss(
  linked: readonly LinkedNote[],
  scriptId: string,
  rung: string | null,
): { rung: string | null; noteIds: number[] } {
  const ofScript = linked.filter((l) => l.script_id === scriptId);
  const onRung = rung ? ofScript.filter((l) => l.rung === rung) : [];
  const chosen = onRung.length ? onRung : ofScript.filter((l) => l.rung === null);
  return {
    rung: onRung.length ? rung : null,
    noteIds: chosen.map((l) => l.note_id).sort((a, b) => a - b),
  };
}
