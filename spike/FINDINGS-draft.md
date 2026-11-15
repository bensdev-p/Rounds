# M3.1 findings so far (draft, 15 Nov 2026)

Setup: Anki 26.9.4 (Python 3.13), AnkiHub 2026-10-08.1, AnKing Step Deck via AnkiHub on the
developer's real profile ("User 1"): 28,676 notes, 35,097 cards, 35,045 suspended. FSRS on.
Tags: #AK_Step1_v12, #AK_Step2_v12, #AK_Step3_v12, #AK_Other (44,969 tags).

## Ids
- Note ids are AnKing's originals (e.g. 1461870100824 = 28 Apr 2016): AnkiHub rewrites every
  subscriber's note ids to the deck's `anki_nid` (AnkiHub `main/importing.py:657-668`).
- **Card ids are not stable:** they were made at import (1794757606591 = 15 Nov 2026 15:46 UTC).
  Link by note id; actions name note ids (a note's cards are found locally).
- Still to check: a second profile (spike) dump, then 5b compare (guid → note id).

## Finding a script's notes
- Keyword match on AnKing tag topics: 97–219 notes (117–307 cards) per script. Far too many to
  unsuspend on one miss; result.png draws "Unsuspend 3 Anki cards".
- Noise: "dka" matched AMBOSS article ids (#AMBOSS::Dka1Jk). Match topic parts, skip resource ids.
- Nephritic and nephrotic share 170 notes ("Nephritic_vs_Nephrotic" tags).
- Anki search is slow for this: 2.3–6.5 s per script, 37 s for five scripts together.
  Searching must not happen at sync time: store note ids in the script (M3.2 tooling proposes,
  developer confirms), so the add-on only reads ids.

- Probe 2b (one SQL pass over tags): scan 214 ms, matching five scripts 2.7 s in Python.
  Still too slow to repeat every sync; fine for M3.2 tooling.
- **Step 2 #Subjects narrows to the topic, and its leaves follow rungs:** e.g.
  `#AK_Step2_v12::#Subjects::Gastroenterology::11_Pancreas::Pancreatitis::Acute_Pancreatitis::Management`
  and `::Pathophysiology`; DKA and PE have the same `::Management` / `::Pathophysiology` leaves.
  So a miss on the Management rung could unsuspend just that leaf's notes, close to the
  "3 cards" result.png draws. Linking per rung looks possible for rungs that have a leaf.
- `#PANCE::RENAL` (not AnKing) matched nephritic/nephrotic: restrict to `#AK_` tags.

## Review stats
- Reading stats for 933 linked cards: 6 ms. All 35,097 cards: 127 ms.
- Payload: 186 KB for 933 cards (with GUIDs); 7 MB for every card. Upload linked cards only.

## Writing (probe 4, "Rounds spike" profile restored from a backup)
- Unsuspend 3 cards + tag their notes `#Rounds::missed` in one `CollectionOp`, wrapped with
  `add_custom_undo_entry` / `merge_undo_entries`: Edit → Undo shows "Rounds: apply changes" and
  undoes both in one step (developer checked).
- After: queue -1 → 0 (new), usn → -1, mod updated: Anki marks them for the next AnkiWeb sync
  exactly like hand edits.

## AnkiHub and tags
- An AnkiHub update replaces a note's tags except protected, internal and `AnkiHub_Optional::`
  ones (`importing.py:998-1014`), so `#Rounds::missed` is wiped on update. The add-on should
  re-apply it on every sync from the server's list (or the student protects "Rounds" in AnkiHub).

## AnkiWeb sync test (real profile)
- Tagging one note `#Rounds::sync_test`, syncing, then removing it and syncing again worked like
  any hand edit (developer checked).

## Pairing and sync in Anki (ran on the real profile "User 1", not the spike profile)
- Code typed into the add-on, connected, synced: 933 linked cards uploaded (927 suspended).
- Page queued unsuspend + tag for 3 cards; next sync applied both (3 and 3) and reported back.
- Timings: gathering 33–35 s (Anki search for the linked notes, every sync), uploading
  186 KB 60–70 ms, second upload 58 ms. Confirms: store note ids, never search at sync time.
- Add-on config is per install, not per profile: the device token pairs every profile on that
  computer to the same Rounds account, and the token ended up on the real profile. Pairing
  must be stored per profile (e.g. in the collection's config, which also syncs: decide).
- Syncing on profile open applies pending actions without asking. The real add-on should
  show what it changed (a tooltip and one undo step) the first times.

## Pairing (local stack)
- Code single use, accepts lowercase and spaces; wrong code 404, bad token 401, extra fields
  (card text) refused. Claim 20 ms. Sync of 1,500 fake cards (270 KB): 178 ms.
