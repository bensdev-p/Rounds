# Rounds — Roadmap

This file sets the order of work. `docs/PRODUCT.md` says what Rounds is. `CLAUDE.md` says how to build it. `docs/design/` (mockups, wireframes, DESIGN.md) and the vision video say what it looks like and how it behaves. This file says **what to build next and what to leave alone.**

## How to use this file
- Work on **one milestone at a time**. Start each one in a fresh Claude Code session, and begin by reading this file.
- Milestones run in order. Stages are groups of milestones, not waiting periods.
- **The design is finished.** Mockups, wireframes and the video are the target. Each milestone builds or brings its screens up to them, and doesn't redesign them.
- **Content review and testing never block development.** Scripts stay `in_review` until the reviewer gets to them. The developer tries each milestone as it lands. There are no testing windows.
- New ideas go in **Parking lot** at the bottom. They aren't requirements until the developer moves them into a milestone.

## Definition of done (every milestone)
1. Each screen it touches matches its mockup (dark, and light where a light mockup exists) and its wireframe's numbered notes. Flow and motion match DESIGN.md → "The session, start to finish" and the video where it shows that screen.
2. Pure logic is in `packages/shared` with unit tests. `pnpm typecheck && pnpm lint && pnpm test` pass, and so do `pnpm db:test` after any migration.
3. Code only adds questions as `in_review`, each tracing to a field of its script (domain rule 1).
4. The developer has tried it: on his phone via `pnpm start` or a TestFlight build, and for the Anki add-on in Anki on his PC.
5. The screen map below is updated.

---

## Where things stand (15 Nov 2026)

**Built:** the text pimp ladder; grading (a local matcher with Claude as a fallback, plus an eval set); personas; progression (rounds, shifts, rank, mastery); Home, the script picker, live session (text), list feedback, the result screen with the miss card, the clean run, Promotion, the illness script, the script collection and Progress; the "This is wrong" flag and its review queue; the PHI guard; the content pipeline; RLS with pgTAP tests. All 30 IM scripts are drafted and `in_review`, shown locally as "Not yet reviewed".

**M1.1 (varied questions):** every script has two questions per rung (all `in_review`). A session asks one per rung at random and avoids the last session's questions. "Pimp me" picks from the rotation, weighted toward missed and unseen scripts.

**M1.2 (mockup check):** every built screen matches its mockup in dark and light: type back to the DESIGN.md scale, spacing from the mockup CSS, persona order, "Change rotation" and long-press on Pimp me, the list feedback line, and the test fixtures hidden from students' screens.

**M1.3 (tab shell and Profile):** a tab bar with Pimp, Log, Review and Profile, hidden on session screens and the illness script. Progress is the Profile tab, matching `profile.png` (dark and light), with a Settings entry. Settings is a placeholder holding the daily goal. Log and Review show honest empty states. Tried on the phone. **Stage 1 is complete.**

**M2.1 (Log):** the Log tab matches `log.png` and wireframe 08. Autocomplete against script names and aliases; the patient-detail guard runs on every keystroke (names, titles, dates, 6+ digit numbers, phone numbers and the rest), turns the field coral, says exactly what to remove and turns Save off. A diagnosis with no matching script is saved under what was typed ("No script yet"). "Logged today" shows a pass dot and "Pimped, rung N" once a session on that script is finished today, otherwise a signal dot and "Not yet". Home has "From today's patients" with one-tap Start rows, "Log one" and the empty state. New `patient_logs` table (label, optional script, rotation, time; own rows only) with pgTAP tests. Tried on the phone.

**M2.2 (Review):** the Review tab matches `review.png`, `review-light.png` and wireframe 09. "Missed today" lists up to five scripts, oldest first; the rest roll to tomorrow, and a miss clears once a later ladder gets past the missed rung (or after a week). The line under each uses the miss card's label ("Missed on management"), or names the list items left out ("Missed uremia, salicylates"), kept to one line. Each row opens the script, whose back link then says "Review" (`script.png`). "You keep mixing these up" appears when the same pair was confused 2+ times in 7 days, with the comparison columns sliding in (video scene 7) and "Drill this pair": both scripts' Tell it apart questions, taking turns (up to 4), ending on the first miss, saved as a drill that never counts toward best rung, rounds, rank or mastery. "From today's patients" lists logged scripts not yet pimped today, with Start. The Anki row stays hidden until M3.1. New: `attempts.matched`, `ladder_sessions.kind` and `partner_script_id` (pgTAP tests); comparison rows on every `confused_with` pair (13 pairs, still `in_review`). Tried on the phone.

**M2.3 (accounts, onboarding, settings):** every student still starts without an account. Onboarding (wireframe 01) asks year and rotation, plus an optional "Week 3 of 8" row (not drawn), and shows whenever there's no profile yet, keeping the persona and goal a device already had. Home shows "Week 3 of 8" before "Change rotation", which now opens the same questions; the script picker is a link from there and still a long press on Pimp me. A rotation with no scripts yet (OB/GYN) says so and asks from the others. Settings (wireframe 12, no Anki): Daily goal above Voice (developer's call), Answer timeout (Persona default, 10 s, 30 s, 60 s, No limit), Appearance (Light, Dark, System, per device; replaces `EXPO_PUBLIC_THEME`), Account. Account (not drawn): sign in with a 6-digit email code (works from the phone on the home Wi-Fi; codes land in Mailpit locally), Sign in with Apple in the iPhone build only, sign out, delete account (`delete-account` Edge Function). Signing in adds the email or Apple ID to the same anonymous user, so history carries over; an email that already has an account signs in to it, after a warning if this phone has practice that stays behind. "Keep your progress" shows once on the result screen after the first session. New `profiles` table (pgTAP tests); persona and goal moved there from the device. Local auth now confirms emails, as a hosted project does. Tried on the phone.

**M2.4 (voice spike):** measured on a throwaway branch (`m2.4-voice-spike`, not merged). About 0.5 s from the end of speech to the next question is reachable when the local matcher grades. A Claude fallback adds 1.5–2.6 s, so M2.5 plays a short "thinking" cue on a matcher miss. Speech-to-text: Deepgram Nova-3 with the question's accepted answers as expected words. Voice: Deepgram Aura-2, one voice per persona (developer's pick). Findings under M2.4 below.

**Gaps:** none in Stage 2.

**M2.5 (voice session):** sessions open in voice. The attending asks in the persona's Deepgram Aura-2 voice (question audio made once per persona and speed, cached in a private `voice-cache` bucket, and fetched for the whole run when it starts). The mic goes live when the question ends: Deepgram Nova-3, streamed straight from the device with a 60 s token from `speech-token` and the question's accepted answers as expected words. Our own silence check ends the answer (0.8 s, 1.5 s on list questions) or a tap on the mic does; holding the mic keeps it listening through a long pause, and letting go ends the answer (developer's call). The transcript is graded like typed text; when the matcher misses, the attending says "Mm-hm." while Claude grades. Nothing plays on a miss. "Type instead" switches to text for the rest of the session; a session opens in text mode with one line saying why when the mic is refused or voice isn't available (Safari over http, no `DEEPGRAM_API_KEY`). The matcher reads number words as digits and skips "um" and "uh". Mic icon on Pimp me and Pimp me on this; Settings → Voice → Attending voice speed (0.8×, 1.0×, 1.2×, 1.4×, in the profile). Speech sits behind the `stt` and `tts` provider interfaces (`supabase/functions/_shared/speech`), with fakes for `functions:serve:fake`. The iPhone runs an EAS development build (`docs/PHONE.md`), which also brought two native fixes: the voice is converted to the phone's audio rate (it played fast and high), and screens rise with the iOS keyboard. The result screen's big score numeral no longer clips on iOS. In voice mode a question over three lines collapses the ladder to its strip (developer's call). New: `profiles.voice_speed` and the bucket (pgTAP tests). Tried on the phone.

**M2.6 (hosting and TestFlight):** a private hosted Supabase project, `rounds-dev` (Free plan), with every migration, the auth settings from M2.3 (anonymous sign-ins, manual linking, 6-digit codes, Sign in with Apple with `com.ben.rounds`), the four Edge Functions and their secrets. Release rule (developer, 14 Nov): `rounds-dev` shows `in_review` scripts to the developer and the reviewer only, through TestFlight internal testing; domain rule 2 now says so, and `supabase/hosting.json` lists the projects allowed the preview. New `pnpm content:push` sends approved and in-review scripts (never drafts or test fixtures) to the linked project in one all-or-nothing statement and retires scripts the repo drops. `eas.json` has a `production` profile and `eas submit`; store builds read the hosted URL and key from EAS environment variables and leave out the local-network permission. Email sign-in waits for SMTP: the Free plan's built-in email can't send the code template (developer's call to ship without it). Setup and each release: `docs/HOSTING.md`. Build 2 is on TestFlight and was tried on the phone: text and voice sessions, Claude grading, Sign in with Apple, delete account. **Stage 2 is complete.**

**M3.1 (Anki spike):** findings under M3.1 below. Link scripts by AnKing note id (card ids differ per student), with an optional rung from AnKing's Step 2 `#Subjects` leaves; never search the collection at sync time; pair per Anki profile; re-apply `#Rounds::missed` after AnkiHub updates; a `.ankiaddon` file for Stage 3.

**Next: M3.2 Link scripts to Anki cards.**

## Screen map

| Screen | Wireframe | Mockup | Status | Milestone |
|---|---|---|---|---|
| Home (Pimp) | 02 | home, home-light | Matches (M1.2). From today's patients (M2.1). Week line and Change rotation (M2.3). Mic icon on Pimp me (M2.5) | Done |
| Script picker | 03 | — | Matches wireframe (M1.2), reached by "Change rotation" or long-press on Pimp me. Filter chips: Parking lot | Done |
| Live session, text | 05 | session, session-light | Matches (M1.2); varied questions (M1.1) | Done |
| List feedback | 06 | list | Matches (M1.2), with the attending's line | Done |
| Result + miss card | 07 | result | Matches (M1.2). Anki row M3.4; flag link kept below progress. "Keep your progress" panel once, after the first session (M2.3, not drawn) | Done |
| Clean run | 13 | win, win-light | Matches (M1.2). Keeps "Next topic"; light "Script mastered" badge text needs a dark-amber token | Done |
| Promotion | 14 | promo | Matches (M1.2) | Done |
| Illness script | 10 | script | Matches (M1.2). Back link says "Review" when opened from Review (M2.2). Mic icon on Pimp me on this (M2.5) | Done |
| Script collection | 15 | collection, collection-light | Matches (M1.2) | Done |
| Profile | 11 | profile, profile-light | Matches (M1.3): the Profile tab, titled Progress, with a Settings row. Teams row: Stage 5 | Done |
| Tab bar (Pimp, Log, Review, Profile) | — | all tab screens | Built (M1.3). Shown on Home, topic picker, Log, Review, Profile, collection, Settings; hidden on session screens and the illness script | Done |
| Log | 08 | log | Matches (M2.1). Subtitle shows the rotation only until scripts have a system field | Done |
| Review + mix-up drill | 09 | review, review-light | Matches (M2.2). Drill screens reuse the session and result pieces (not drawn). Anki row M3.4 | Done |
| Onboarding | 01 | — | Built (M2.3), plus an optional week row. Also used by Change rotation. MS1–2 systems: Stage 5 | Done |
| Settings | 12 | — | Built (M2.3): daily goal, answer timeout, appearance, account. Attending voice speed (M2.5). Anki part M3.3 | Done |
| Account | — | — | Built (M2.3, not drawn): email code, Apple (iPhone build), sign out, delete. On TestFlight (M2.6): Apple and delete work; email code waits for SMTP on the hosted project | Done |
| Live session, voice | 04 | session | Built (M2.5): voice panel as drawn (mic, waveform dots while asking and bars once live, three-line transcript), Type instead, I don't know. Questions over three lines collapse the ladder to its strip (developer's call), as with the keyboard. Tried on the phone (development build) | Done |
| Team board, join, challenge | 16–18 | team, team-light, team-join, challenge | Not built | Stage 5 |

---

## Stage 1 — Prototype (local, text)

### M1.1 Varied questions
**Goal:** the second and third sessions on a script feel different.
- Allow 2–3 questions per rung. The engine picks one per rung at random, and avoids last session's pick when it can.
- **"Pimp me on IM":** the app picks the script, weighted toward scripts she has missed or hasn't seen yet, with some randomness.
- Draft the extra questions for all 30 scripts as `in_review`, from existing script fields only. Run `content:check`, and keep the fixtures and seed in step.
- Schema, seed and stats keep working with more than one question per rung. Best rung and mastery still count rungs, not questions.
- **Out of scope:** new rungs, adaptive difficulty, new personas.

### M1.2 Mockup check of the built screens
**Goal:** every built screen matches its mockup exactly.
- Open each built screen in the map next to its PNG (and its recreated screen in `apps/video/src/screens/`). List the differences, then fix them: spacing, type, radii, colour use, copy, empty and error states, and light mode.
- Check the session flow against DESIGN.md: rung pass at 280 ms, how a miss behaves, the transcript keeping its height, Reduce Motion.
- **Out of scope:** changing the mockups. If one can't be built as drawn, ask.

### M1.3 Tab shell and Profile
**Goal:** the app has its final structure.
- Tab bar with Pimp, Log, Review and Profile. Session screens hide it. Log and Review get honest empty states until their milestones land.
- Progress becomes the Profile tab, matching `profile.png` and wireframe 11, including the entries that open settings (placeholder) and, later, Teams (hidden until Stage 5).

**Stage 1 was completed on 14 Nov 2026.**

---

## Stage 2 — iPhone beta

### M2.1 Log
- Matches `log.png` and wireframe 08: diagnosis label, rotation and date only. The PHI guard blocks and explains, as in video scene 6.
- Labels map to scripts where one exists. A log with no matching script is still saved.
- **Home, "From today's patients"** (`home.png`, wireframe 02 note 3): today's logs as one-tap Start rows, a "Log one" link, and the empty state "Log a patient to practise on them tonight." Left out in M1.2 because there was no Log yet.
- **Notes for the plan (from M1.3):**
  - The Log tab is an empty state in `apps/mobile/src/app/(tabs)/log.tsx`; replace it. Tab screens use `<Screen tab>`.
  - There's no table for logs yet. It needs a migration with RLS (own rows only), pgTAP tests, `pnpm db:types` and a Zod schema in `packages/shared`. Columns: label, matching script (optional), rotation and when it was logged. Nothing that could hold patient details (domain rule 5).
  - The PHI guard exists (`detectPhi` in `packages/shared`, already used by the topic picker). Wireframe 08 note 1 lists what it must catch on every keystroke.
  - "Logged today" status ("Pimped, rung 5" or "Not yet", wireframe 08 note 2) comes from today's finished sessions on the matching script.
  - **Ask the developer:** wireframe 08 and `log.png` draw Save only on matching-script rows, but a log with no matching script must still be saved. How that save looks isn't drawn.
  - Leave Review's empty state alone until M2.2.

### M2.2 Review and learning from today's patients
- Matches `review.png` and wireframe 09: "Missed today" uses the miss card's wording; there's a link to each script.
- **Mix-up drill:** repeated `confused_with` misses lead to a side-by-side comparison (video scene 7).
- **Learning from today's patients:** today's logged diagnoses offer their script and a short ladder.

### M2.3 Accounts, onboarding, settings
- Supabase Auth (email magic link, Sign in with Apple) that carries over the anonymous history.
- Onboarding (wireframe 01): year, rotation, persona and daily goal. Settings (wireframe 12) without the Anki part.
- **Home, "Week 3 of 8"** (`home.png`): once onboarding records the rotation's start and length, show the week line before "Change rotation". Left out in M1.2 because there was no rotation date.

### M2.4 Voice spike (throwaway branch)
- STT → grade → TTS on one script. Measure the time from the end of speech to the next question, and compare two vendors.
- What you get from it is a number and a recommendation, not code to keep. If ~1 s isn't reachable, choose a fallback (push to talk, a short "thinking" cue) before M2.5.

**Findings (14 Nov 2026).** Spike code on branch `m2.4-voice-spike` (a hidden `/spike` web page and a local-only `voice-spike` Edge Function; not merged). Script: acute pancreatitis, rungs 1–5. Answers were recorded speech played into the mic pipeline (so runs repeat), in Chrome on the PC; the phone wasn't tested, since Safari blocks the mic on the http LAN address. Times are from the end of the student's speech to the next question starting to play, median / worst, about 10 turns per row.

| Speech-to-text, next question | Vendor decides "done" (300 ms) | Our silence check (300 ms) |
|---|---|---|
| Deepgram Nova-3, cached audio | 0.73 / 0.76 s | **0.54** / 0.97 s |
| ElevenLabs Scribe v2, cached audio | 0.75 / 1.07 s | **0.50** / 0.88 s |
| ElevenLabs Flash v2.5, voiced live (`<audio>` player) | 0.92 / 1.63 s | 0.69 / 0.73 s |

Voiced live, measured on its own (time to first sound, 24 clips each): with a player that streams raw audio and starts on the first piece, **Deepgram Aura-2 0.22 s** (worst 0.52) and **ElevenLabs Flash 0.24 s** (worst 0.31). Through the browser's `<audio>` mp3 player Deepgram took 1.1 s (worst 2.2): it sends its mp3 in many small pieces, and the player waits for a buffer first. M2.5 should stream raw audio, as a native app would anyway.

Accuracy on the script's hard terms (12 answers × 2 voices, 38 terms; a few misses were network errors or cut-off answers, not mishearing):

| Speech-to-text | Alone | With expected words |
|---|---|---|
| Deepgram Nova-3 | 32 | **38** |
| Deepgram Nova-3 Medical | 33 | 34 |
| ElevenLabs Scribe v2 realtime | 35 | not finished (token errors) |
| ElevenLabs Scribe v3 live | 35 | **38** |

Mishearings without expected words: "Waldorf necrosis", "Chetoacidosis", "thiazidase", "Write up a quadrant", and "ALT" as "out". The medical model fixed some of these alone, but gained nothing from expected words (Deepgram's docs list keyterm support for Nova-3, not the medical model). Nova-3 Medical's launch price matches Nova-3's ($0.0077/min streaming), so it isn't ruled out on cost, only on results.

- **Grading decides it.** The matcher's round trip is about 65 ms. When it misses, the Claude fallback brings the whole turn to 2.0 s with Haiku 5.5 (worst 2.5 s) and 2.5 s with Opus 5.5 (worst 3.1 s), whichever speech vendor is used. So ~1 s holds only for answers the matcher grades.
- **Fallback for M2.5:** on a matcher miss, play a short cached "thinking" cue at once (the attending's "mm-hm"), then the next question when the grade arrives. Push to talk only saves the 0.3–0.6 s of waiting for silence, so it doesn't fix this.
- **Recommendation:** Deepgram Nova-3 with expected words for speech-to-text: as accurate as ElevenLabs' newest model, with a steadier worst case and fewer cut-off answers in the timing runs. ElevenLabs caps each expected word at 20 characters. For the voice, both start in about 0.2 s with a streaming player, so it came down to how they sound. Both sit behind the `stt` and `tts` interfaces, so this can change.
- **Voices (developer, 14 Nov):** Deepgram Aura-2 for the attending, one voice per persona: Teacher `aura-2-harmonia-en`, Surgeon `aura-2-orpheus-en`, Internist `aura-2-atlas-en`. So Deepgram covers both speech-to-text and voice: one key, one bill. Rank is the student's title and doesn't change the voice. Each question's audio is cached once per persona voice; live follow-ups use the current persona's voice.
- **Spending caps (developer, 14 Nov):** $10 per speech vendor. The spike's speech cost was well under that.

**Notes for the M2.5 plan (from M2.4):**
- End the turn with our own silence check, not the vendor's: it saved about 0.2 s. 300 ms of silence is too short for list questions and for anyone who pauses mid-answer: it cut answers off ("I'd say the pancreas is inflamed" lost "from the alcohol"). Try a longer wait on list questions, and only end the turn once the speech has really stopped.
- Both vendors misheard "ALT" (as "A", "LT" and "out"), which sent the answer to Claude and once graded it wrong. Pass the question's accepted answers and synonyms to the vendor as expected words: it took both Nova-3 and Scribe v3 to 38/38.
- Before switching the grader to Haiku for speed, check its grading with `pnpm eval:grading --model claude-haiku-5-5` (billed: the developer's OK first).
- Deepgram needs an API key with the Member role to issue the browser's short-lived tokens.
- Trying voice on the phone: the developer has an Apple Developer account, so use an EAS development build (cloud build, installed on his registered iPhone). Safari would need HTTPS for both the app and Supabase. Streaming the mic natively needs a native audio module, which a development build allows and Expo Go doesn't.
- Play voiced audio by streaming raw audio into the player, not through an mp3 element.
- Keep the streaming connection open and the next question's audio ready before the student speaks; the spike measured with both ready.

### M2.5 Voice session
- Wireframe 04 and `session.png`: an idle dotted waveform while the attending asks, live once the question ends. Common questions use cached audio. Everything sits behind the `stt` and `tts` provider interfaces. Text mode stays available everywhere.
- **Mic icon** on "Pimp me" (Home) and "Pimp me on this" (illness script), as in `home.png` and `script.png`. M1.2 kept the ladder icon because the app was text-only.
- **Voice speed** row in Settings → Voice (wireframe 12), left out in M2.3 because there was no voice yet.

### M2.6 Hosting and TestFlight
- A hosted Supabase project, Edge Functions with a spending cap on the API key, an EAS build and TestFlight. The developer has no Mac, so cloud builds only.
- **Accounts on the hosted project (from M2.3):** keep "Confirm email" on, turn on anonymous sign-ins and manual linking, use code email templates like `supabase/templates/`, deploy `delete-account`, and set up real email sending (SMTP).
- **Sign in with Apple (developer setup):** Apple Developer Program membership; bundle id `com.ben.rounds` (in `app.json`, with `usesAppleSignIn`); EAS switches on the capability during the cloud build; in the hosted Supabase project, Authentication → Providers → Apple with `com.ben.rounds` as a client id (no secret needed for the native flow). Try it on the first TestFlight build: the web app doesn't offer Apple.
- **Release rule:** a build that people other than the developer and the reviewer can use shows only `approved` scripts. **Decided (developer, 14 Nov 2026):** a private hosted dev project may show the preview; only the developer and the reviewer use it, through TestFlight internal testing. Domain rule 2 updated; `pnpm content:push --preview` only works for projects in `supabase/hosting.json` → `previewProjects`.
- **Notes for the M2.6 plan (from M2.5):**
  - Deploy all four Edge Functions: `grade-answer`, `delete-account`, `speak`, `speech-token`. Set the secrets `ANTHROPIC_API_KEY` and `DEEPGRAM_API_KEY` (Member role, needed to grant streaming tokens). Pushing the migrations creates the private `voice-cache` bucket, which only the functions use.
  - The EAS project is linked (`app.json` → `extra.eas.projectId`, owner `benfb03`). `eas.json` has only a `development` profile; TestFlight needs a store profile (for example `production`) and `eas submit`.
  - Today the development build reads `EXPO_PUBLIC_SUPABASE_URL` and the key from `.env.local` through Metro. A TestFlight build bundles them at build time, so they need setting as EAS environment variables pointing at the hosted project.
  - `ITSAppUsesNonExemptEncryption: false` is already set. The local-network permission text is only for development; decide whether release builds keep it.
  - Voice audio is made the first time a question is asked, then cached. On the hosted project that first ask costs a little speech credit per question, persona and speed (cap $10 per speech vendor).
  - After `pnpm test:integration`, restart `pnpm functions:serve` (or use `pnpm start`): the fake server stays running in Docker otherwise, and the app hears tones.
  - Phone testing so far uses the development build (`docs/PHONE.md`); Developer Mode appears only after it's installed.

---

## Stage 3 — Anki bridge

**Goal:** what a student misses on rounds shows up in their Anki. A Python add-on (`packages/anki-addon`) pairs with their Rounds account, uploads review statistics for cards linked to scripts, and applies the actions Rounds sends back: unsuspend cards, tag `#Rounds::missed` (PRODUCT.md → Anki bridge). It never reads or uploads card text (domain rule 6).

Facts to plan around:
- **No script has `anki_refs` yet** (0 of 30). The schema exists: `{ kind: 'note' | 'card', id }`, numeric ids only. Linking scripts to AnKing notes is real work and needs the developer's AnKing collection.
- **Add-ons run only in Anki on a computer.** AnkiMobile on the iPhone has none, so sync happens when the student opens Anki on their PC or Mac; the phone sees results once synced.
- **The add-on reaches Rounds through Edge Functions** on the hosted project (`rounds-dev` today), signed in with the pairing code, never with a secret key.
- Screens: Settings → Anki (wireframe 12, note 1: one-time code, no password typed into Anki), "Anki sync status" on Review (wireframe 09, note 3: hidden until connected), "Unsuspend 3 Anki cards" on the result screen (`result.png`, `review.png`).

### M3.1 Anki spike (throwaway branch)
- A minimal add-on loaded into the developer's Anki desktop with his AnKing deck. Find out: whether AnKing note ids are stable across installs and updates (AnkiHub); how to find a script's notes without storing card text (AnKing tags, search); which review statistics the add-on can read (revlog) and how cheaply; how to unsuspend and tag safely (undo, sync with AnkiWeb).
- Try one-time-code pairing end to end against the local stack.
- What you get from it is findings and a recommendation (how scripts link to cards, the sync shape, how the add-on is installed: an AnkiWeb listing or a `.ankiaddon` file), not code to keep.

**Findings (15 Nov 2026).** Spike code on branch `m3.1-anki-spike` (an add-on with a Tools → Rounds spike menu of probes, a local-only `anki-spike` Edge Function and table, a hidden `/spike-anki` page; not merged). Setup: Anki 26.9.4 (Python 3.13) on the developer's PC, AnKing Step Deck through AnkiHub (2026-10-08.1) on his real profile: 28,676 notes, 35,097 cards, all but 52 suspended, FSRS on. Writes ran in a "Rounds spike" profile restored from a backup, with no AnkiWeb or AnkiHub sign-in. The probes read ids, tags and scheduling numbers only, never note fields.

| Question | Answer |
|---|---|
| Stable ids | **Note ids, yes; card ids, no.** AnkiHub rewrites every subscriber's note ids to AnKing's own (its `main/importing.py`), and the notes carry AnKing's 2016-era ids. Card ids were made at import (timestamps from that day), so they differ per student. Not tested: students on the free AnKing `.apkg` without AnkiHub. |
| Finding a script's notes | Matching AnKing tag topics finds 83–324 notes (117–307 cards) per script: far more than "Unsuspend 3 Anki cards". Noise: "dka" matched AMBOSS article ids, `#PANCE::` tags (not AnKing) matched nephritic/nephrotic, and those two scripts share 170 notes. **Step 2 `#Subjects` narrows to the topic, and its leaves follow rungs:** `…::Acute_Pancreatitis::Management`, `::Pathophysiology` (DKA and PE have the same). |
| Cost of searching | Anki search: 2–7 s per script, 33–37 s for five. One SQL pass over tags: 0.2 s scan plus 2.7 s matching. Too slow for every sync either way. |
| Review statistics | Suspended, queue, due, interval, reps, lapses (cards table) and last review (revlog): 6 ms for 933 linked cards, 127 ms for all 35,097. 186 KB of JSON for 933 cards; 7 MB for every card. |
| Unsuspend and tag | One `CollectionOp` with a custom undo entry: Edit → Undo shows "Rounds: apply changes" and undoes both in one step. Changed cards get `usn -1`, so they go up on the next AnkiWeb sync like hand edits; the one-note AnkiWeb test confirmed it. |
| AnkiHub and our tag | An AnkiHub update replaces a note's tags except protected, internal and `AnkiHub_Optional::` ones, so `#Rounds::missed` is wiped when AnKing updates that note. |
| Pairing | Code (8 characters, no 0/O/1/I/L, 10 minutes, single use, stored hashed) typed into the add-on, traded for a device token (stored hashed). The function runs with gateway JWT checks off and checks the token itself; extra fields such as card text are refused. Claim 20 ms; upload of 186 KB 60–70 ms; actions queued on the page were applied on the next sync and reported back (3 and 3). |
| Install | A `.ankiaddon` is a zip of the add-on's files with no top-level folder and no `__pycache__`, plus `manifest.json` (`package`, `name`) when shared outside AnkiWeb: built (7 KB), installed by double-clicking, and the menu appeared after a restart. AnkiWeb's docs don't cover review, updates or network rules. |

- **Recommendation, linking:** `anki_refs` stores AnKing **note ids** (the existing `kind: 'note'`; drop `card` for AnKing), chosen once per script in M3.2, never searched at sync time. Add an optional **rung** to each ref so a miss on Management unsuspends that rung's notes (from the Step 2 `#Subjects` leaves where they exist), falling back to the script's core notes. That is a schema change in M3.2. Restrict proposals to `#AK_` tags and skip resource-id branches (`#AMBOSS`).
- **Recommendation, sync shape:** the server sends the add-on the note ids linked to scripts; the add-on finds their cards locally and uploads per-card numbers (ids and numbers only, no GUIDs needed), about 1k cards and under 200 KB for 30 scripts. Actions name note ids. Sync when a profile opens and after Anki's own sync. The add-on re-applies `#Rounds::missed` on every sync from the server's list, since AnkiHub wipes it.
- **Recommendation, pairing:** as tried, plus a limit on claim attempts. Store the pairing **per Anki profile**: the add-on config is shared by every profile on the computer, so pairing in one profile connects them all. The developer paired from his real profile, and the test unsuspended and tagged 3 cards there (put back by hand).
- **Recommendation, install:** a `.ankiaddon` file for the developer and the reviewer during Stage 3; an AnkiWeb listing (one-click install by code, updates) for launch, after reading AnkiWeb's add-on terms.

**Notes for the M3.2–M3.4 plans (from M3.1):**
- M3.2 tooling can run as an add-on menu item that writes proposed note ids per script and rung to a file the developer confirms; the repo gets ids only. Tag names are AnKing metadata: keep them out of the repo too, unless the developer decides otherwise.
- M3.3: sync applies changes without asking, so show what changed (a tooltip naming the count) and keep the single undo step. Python tests can use a real empty `Collection` from the `anki` package.
- M3.3: decide whether students without an account can connect Anki (the device token is tied to the anonymous user, as everything else is).
- M3.4: "Unsuspend 3 Anki cards" needs the suspended count among the missed rung's linked notes, from the last upload; Review's "7 Anki cards unsuspended today" needs the applied counts the add-on reports back.

### M3.2 Link scripts to Anki cards
- `anki_refs` for the IM scripts, ids only, as a content change (`pnpm content:check` and `content:push`), using the approach M3.1 picks. Tooling that proposes refs from the developer's collection; the developer confirms.
- The `anki_refs` schema may change with the approach (M3.1 recommends AnKing note ids with an optional rung).
- The illness script screen may show how many cards are linked only if a mockup draws it; otherwise ask.

### M3.3 Pairing and sync
- Settings → Anki (wireframe 12): Connect Anki, a short one-time code, connected state, disconnect.
- Tables with RLS (own rows only) and pgTAP tests: pairings, uploaded review statistics per linked card (ids and numbers only), pending actions. Edge Functions for pairing and sync. Zod schemas in `packages/shared`.
- The add-on: pairing dialog, sync on profile open and close, applies unsuspend and tag actions, Python tests with a fake collection.

### M3.4 Anki in the app
- Result screen: "Unsuspend 3 Anki cards" (`result.png`) after a miss on a script with linked cards; tapping it queues the actions for the next sync. When Anki isn't connected, the row says "Connect Anki" instead (wireframe 07 note 3).
- Review: "Anki sync status" row (wireframe 09 note 3, `review.png`), hidden until connected.
- Misses tag their script's cards `#Rounds::missed` on the next sync.

## Stages 4–5 (detail added when Stage 3 is done)
- **4. Launch:** public web portal, marketing site (copy follows DESIGN.md → Voice and copy), payments, Android.
- **5. Expand:** all rotations, shadowing mode (including organ systems instead of rotations for MS1–2 in onboarding, wireframe 01 note 1; scripts need a "system" field first), Teams (mockups and wireframes 16–18 are ready), desktop decision, school licenses.

## Decisions for the developer (not Code)
- **Review at scale:** who reviews scripts for rotations other than IM. This is needed before a public release, not before building.
- **Name and button label** ("Pimp me" or "Ask me"): decide before anyone outside the household sees it.
- **Spending caps:** speech $10 per vendor (14 Nov 2026); hosting $0 (Supabase Free plan, M2.6). Grading: set a monthly spend limit on the Anthropic workspace whose key `rounds-dev` uses (not yet set).
- **For Stage 3:** answered 15 Nov 2026. AnKing Step Deck through AnkiHub (paid, on the developer's own profile only); the spike read the real collection; the write test ran on a restored copy, and the sync tag test and pairing ran on the real profile (changes undone). Later: whether the add-on is listed on AnkiWeb or shared as a file (M3.1 recommends a file for Stage 3, AnkiWeb at launch).
- **Hosted dev preview:** decided 14 Nov 2026. One private hosted project (`rounds-dev`) shows `in_review` scripts to the developer and the reviewer only, through TestFlight internal testing. A production project with approved scripts only comes before anyone else gets a build (`docs/HOSTING.md`).

## Frozen unless the developer reopens them
Mockups, wireframes and the vision video (finished) · new progression mechanics · Teams before Stage 5 · marketing site · Android · desktop · payments.

## Parking lot
(Add ideas here with a date. Moving one into a milestone is the developer's call.)
- Show the reviewer in the session (PRODUCT.md → Recommendations).
- Morning warm-up on yesterday's logged patients (PRODUCT.md → Recommendations; fits M2.2).
- Open the next session on the missed question.
- When shared UI components exist, swap them into the video (VIDEO.md → Later).
- (13 Nov 2026) A third question on rungs where a script has a third fact worth asking. M1.1 shipped two per rung; the content rules allow three.
- (14 Nov 2026) Filter chips on the topic picker (All, Cardio, Renal, GI; wireframe 03). Scripts need a "system" field first, which is a content change.
- (13 Nov 2026) Weight "Pimp me" by how long ago a script was missed (spaced repetition), not only whether the last session ended on a miss.
- (13 Nov 2026) Show a rung's question versions on the illness script screen.
- (14 Nov 2026) Deleting or editing a patient log. Not drawn; the table already allows deleting your own rows.
- (14 Nov 2026) Use the Log's warning wording ('Remove "…" and keep only the diagnosis') on the topic picker search and the flag note too.
- (14 Nov 2026) The Log's matching-script subtitle reads "Internal medicine, cardiology" in `log.png`; it needs the same "system" field as the filter chips.
- (14 Nov 2026) Mix-up pairs on Profile (PRODUCT.md lists them there). M2.2 shows only the week's top pair, on Review.
- (14 Nov 2026) More than one mix-up pair on Review at a time. Wireframe 09 draws one, and the review is meant to end.
- (14 Nov 2026) A drawn screen for the mix-up drill and its result. M2.2 reuses the live session (four squares instead of the ladder) and the result screen's pieces.
- (14 Nov 2026) Short column headers on the comparison ("Nephritic" in `review.png`). Scripts have only full names, so long ones wrap to two lines.
- (14 Nov 2026) Merging two accounts' history when a student who practised without an account signs in to an existing one. M2.3 warns and leaves the anonymous practice behind.
- (14 Nov 2026) A daily ladder on the public web (Stage 4, alongside the marketing site): one script a day, the same for everyone, playable without an account and kept with it when signed in. A shareable result could be the ladder itself as squares (passed, missed, not reached), with no answers in it. Constraints: approved scripts only (release rule), no "pimp" in public copy (DESIGN.md → Voice and copy), and no-guilt streaks (DESIGN.md → Progression).
- (14 Nov 2026) Tidy the text-mode session with the iPhone keyboard up (developer, M2.5): the answer box now stays above the keyboard, but the layout needs a cleanup pass.
- (14 Nov 2026) A haptic when holding the mic starts keeping it open (developer, M2.5). Holding works; it only has the button's pressed look.
- (14 Nov 2026) Voice in the mix-up drill. M2.5 voiced the pimp session only; the drill stays text (developer's call).
- (14 Nov 2026) A production Supabase project and an approved-only store build, before anyone beyond the developer and the reviewer gets the app (M2.6 release rule).
- (14 Nov 2026) Email sign-in on the hosted project: needs SMTP (e.g. Gmail app password, or Resend with an owned domain), since the Free plan's built-in email can't send the 6-digit code template. M2.6 ships with anonymous use and Sign in with Apple only (developer's call).
- (14 Nov 2026) External TestFlight testing: needs Beta App Review and a privacy policy URL.
- (14 Nov 2026) Over-the-air updates (EAS Update) so JavaScript fixes reach TestFlight without a new build.
- (14 Nov 2026) Revisit after beta testing (developer, M2.3): more onboarding questions; where the daily goal lives (Settings for now); signing in to an existing account from a phone with practice on it.
- (15 Nov 2026) A Rounds deck in Anki (developer, M3.1): the add-on creates its own deck from Rounds' content, for example one card per missed question with its accepted answers, so a miss on rounds becomes an Anki review even for students without AnKing. Possible: the add-on can create a note type, deck and notes, and a stable GUID per question lets updates replace cards in place. Constraints: approved scripts only (release rule), cards trace to script fields (domain rule 1), our own text only, never AnKing's (domain rule 6), and retired scripts' cards are suspended or removed. Best kept to missed questions so it doesn't pile reviews on top of AnKing. Not part of Stage 3 as planned.
- (15 Nov 2026) Linking for students without AnkiHub (free AnKing `.apkg`) and for decks other than AnKing (students' own cards). M3.1 tested AnkiHub only; a second id dump from an `.apkg` import would settle the first.
- (15 Nov 2026) Protecting `#Rounds::missed` in AnkiHub (its protected tags) as an alternative to re-applying it every sync (M3.1).

---

## Prompt to start a milestone in Claude Code
```
Read ROADMAP.md, CLAUDE.md, docs/PRODUCT.md and docs/design/DESIGN.md.
We're on milestone <M1.1>. Open the wireframes and mockups for every screen
it touches. Plan only this milestone: the changes, files and tests, and how
you'll meet the Definition of done. Show me the plan before editing.
Anything outside this milestone goes in ROADMAP.md → Parking lot.
Before branching, check the last milestone's PR is merged and pull main.
Use one branch per milestone, off main.
```
