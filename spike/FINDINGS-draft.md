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

## Review stats
- Reading stats for 933 linked cards: 6 ms. All 35,097 cards: 127 ms.
- Payload: 186 KB for 933 cards (with GUIDs); 7 MB for every card. Upload linked cards only.

## AnkiHub and tags
- An AnkiHub update replaces a note's tags except protected, internal and `AnkiHub_Optional::`
  ones (`importing.py:998-1014`), so `#Rounds::missed` is wiped on update. The add-on should
  re-apply it on every sync from the server's list (or the student protects "Rounds" in AnkiHub).

## Pairing (local stack)
- Code single use, accepts lowercase and spaces; wrong code 404, bad token 401, extra fields
  (card text) refused. Claim 20 ms. Sync of 1,500 fake cards (270 KB): 178 ms.
