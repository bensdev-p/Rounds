# M3.1 Anki spike (throwaway)

Branch `m3.1-anki-spike` only, never merged. Findings go in ROADMAP.md → M3.1.

## Install the spike add-on (Windows)

Close Anki, then link the folder into Anki's add-ons (no copy, so edits apply on restart):

```
cmd /c mklink /J "%APPDATA%\Anki2\addons21\rounds_spike" "%USERPROFILE%\source\Rounds\spike\anki-addon"
```

Restart Anki: Tools → Rounds spike. Reports land in `spike/anki-addon/user_files/` (gitignored).
To test the `.ankiaddon` route instead (remove the link first): in PowerShell, `Compress-Archive spike/anki-addon/*.py,spike/anki-addon/*.json spike/rounds_spike.zip; Rename-Item spike/rounds_spike.zip rounds_spike.ankiaddon`, then double-click it.

## Profiles

- **Real profile:** probes 1, 2, 3, 5 read only. 4b/4c tag one note for the AnkiWeb sync test.
- **"Rounds spike" profile:** File → Switch Profile → Add, name it with "spike", turn AnkiWeb sync off,
  restore a backup or import the AnKing deck. Probe 4 (unsuspend + tag) refuses to run anywhere else.

## Pairing end to end

`pnpm start` (database, functions, web app), sign in, open http://localhost:8081/spike-anki, press
"Get a code", then Tools → Rounds spike → 6. Connect, and 6b. Sync.
