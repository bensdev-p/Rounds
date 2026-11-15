/**
 * `pnpm anki:queue <script-id> [rung] [--tag]`: queue an Anki action on the
 * LOCAL database for the student whose Anki connected most recently, so the
 * add-on has something to apply before the result screen's "Unsuspend 3 Anki
 * cards" row exists (M3.4). Unsuspends the rung's linked notes (or the
 * script's core notes); --tag tags them #Rounds::missed instead.
 */
import { RUNGS } from '../src/schemas/rung.ts';
import { noteIdsForMiss } from '../src/anki/anki.ts';
import { localAdminClient } from './localDb.ts';

const args = process.argv.slice(2).filter((a) => a !== '--');
const tag = args.includes('--tag');
const [scriptId, rung = null] = args.filter((a) => !a.startsWith('--'));
if (!scriptId || (rung !== null && !(RUNGS as readonly string[]).includes(rung))) {
  console.error(`Usage: pnpm anki:queue <script-id> [${RUNGS.join('|')}] [--tag]`);
  process.exit(1);
}

const db = localAdminClient();
const { data: pairing } = await db
  .from('anki_pairings')
  .select('user_id, claimed_at')
  .not('claimed_at', 'is', null)
  .order('claimed_at', { ascending: false })
  .limit(1)
  .maybeSingle();
if (!pairing) {
  console.error(
    'No Anki is connected on the local database. Connect one from Settings → Anki first.',
  );
  process.exit(1);
}

const { data: linked, error } = await db.rpc('anki_linked_notes');
if (error) throw new Error(error.message);
const miss = noteIdsForMiss(
  (linked ?? []).map((l) => ({ ...l, note_id: Number(l.note_id) })),
  scriptId,
  rung,
);
if (!miss.noteIds.length) {
  console.error(`${scriptId} has no linked Anki notes (or isn't shown to students).`);
  process.exit(1);
}

const kind = tag ? 'tag_missed' : 'unsuspend';
const { error: insertError } = await db.from('anki_actions').insert({
  user_id: pairing.user_id,
  kind,
  script_id: scriptId,
  rung: miss.rung,
  note_ids: miss.noteIds,
});
if (insertError) throw new Error(insertError.message);
console.log(
  `Queued ${kind} on ${miss.noteIds.length} note(s) of ${scriptId} (${miss.rung ?? 'core notes'}) ` +
    `for student ${pairing.user_id.slice(0, 8)}. Sync in Anki: Tools → Rounds → Sync with Rounds now.`,
);
