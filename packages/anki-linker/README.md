# Rounds linker (developer only)

A small Anki add-on for linking illness scripts to AnKing notes (M3.2). It is a content tool for the developer and is never given to students; the student add-on (`packages/anki-addon`) comes in M3.3.

It reads note ids and tags only, never note fields (card text), and changes nothing in the collection, so it is safe to run on a real profile.

## Use

1. `pnpm anki:linker:install`, then restart Anki.
2. Open the profile with the AnKing Step Deck. Tools → **Rounds: link scripts**.
3. For each script: check the proposed notes (double-click one to read it in Anki's browser), untick or re-rung any that don't fit, then tick **Confirmed**. Each rung takes at most 3 notes, and the core (no rung) at most 5.
4. **Save**. The dialog shows the path of `links.json` and the command to run:
   ```bash
   pnpm content:link-anki "<path to links.json>"
   ```
   Then `pnpm content:check`, `pnpm content:seed` and `pnpm db:reset`. Pushing to `rounds-dev` (`pnpm content:push --preview`) needs the developer's OK.

Saving again later overwrites `links.json` with the scripts marked Confirmed; reopening the dialog starts from that file, or from the links already in the repo.

## How proposals are made

- Only AnKing's Step 2 subject tags count: `#AK_Step2_v<n>::#Subjects::…`. Resource branches (`#AMBOSS`, `#UWorld`, …), other versions and non-AnKing tags are ignored.
- A script matches the deepest tag segment that contains its name or one of its aliases.
- The segment after the topic picks the rung: Management or Treatment → management, Diagnosis or Workup → workup, Etiology, Risk factors, Pathophysiology or Presentation → recall. Other segments, and the topic itself, are **core**: the notes used when the missed rung has none of its own.
- Notes are ordered by how many other AnKing tags they carry (a rough high-yield signal), and the top ones per rung are ticked to start.

## What reaches the repo

`links.json` and `anki_refs` hold note ids and rungs only: no card text and no tag names (domain rule 6). Note ids, not card ids, because AnkiHub gives every subscriber AnKing's own note ids while card ids differ per student (ROADMAP.md → M3.1 findings).

## Tests

`pnpm anki:test` runs the pure logic in `rounds_linker/linking.py` with Python's unittest (no Anki needed).
