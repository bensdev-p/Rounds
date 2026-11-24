# PimpMe for Anki (the student add-on)

Connects a student's Anki to their PimpMe account (M3.3). Runs in Anki on a computer (Windows, macOS, Linux), not in AnkiMobile.

What it does, each sync:
1. Asks PimpMe (`anki-sync`, `pull`) for the AnKing note ids linked to scripts, the actions waiting (unsuspend, tag `#PimpMe::missed`) and the notes that should carry the tag.
2. Applies them in **one undo step**: Edit → Undo shows "PimpMe: apply changes". A tooltip names the counts. Nothing changes, no undo step. The tag is put back on notes that lost it, because AnkiHub updates wipe it.
3. Uploads per-card numbers for the linked notes (`push`): card and note id, suspended, queue, due, interval, reps, lapses, last review. Never note fields or card text (domain rule 6); the server refuses any extra field.

When: a few seconds after a profile opens, after Anki's own sync, and when a profile closes (upload only, 5 s timeout).

## Connecting

In the PimpMe app: Profile → Settings → Anki → **Connect Anki** shows a code like `ABCD-2345` (10 minutes, once). In Anki: Tools → PimpMe → **Connect to PimpMe…**, enter the code. No password is typed into Anki.

The device token is kept in that Anki profile's own settings: not in the add-on config (shared by every profile on the computer) and not in the collection (which syncs to AnkiWeb). One Anki connection per PimpMe account; connecting again replaces it. Disconnect from either side: Settings → Anki → Disconnect, or Tools → PimpMe → Disconnect.

## Developing

- `pnpm anki:addon:install`, then restart Anki. The installed copy talks to the local stack (`pnpm start`, or `pnpm db:start` + `pnpm functions:serve`).
- `pnpm anki:queue acute-pancreatitis management` queues an unsuspend for the most recently connected Anki (`--tag` tags instead). Then Tools → PimpMe → Sync with PimpMe now.
- `pnpm anki:test`: Python tests (stdlib unittest, a fake collection; no Anki needed).
- `pnpm anki:addon:build` makes `dist/rounds-local.ankiaddon`; `--hosted` makes `dist/rounds-dev.ankiaddon` for the private hosted project. Double-click to install. The hosted file needs the migration and functions on `rounds-dev` first (`docs/HOSTING.md`), which needs the developer's OK.

Try writes on the "Rounds spike" profile first; Edit → Undo puts a sync's changes back.

## Files

- `rounds_anki/__init__.py`: menu, hooks, background work (Anki only).
- `rounds_anki/core.py`: reading card numbers and applying actions; testable without Anki.
- `rounds_anki/client.py`: HTTP to the Edge Functions (standard library).
- `manifest.json`: added to `.ankiaddon` builds.
