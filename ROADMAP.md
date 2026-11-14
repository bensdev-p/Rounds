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
4. The developer has tried it on his phone via `pnpm start`.
5. The screen map below is updated.

---

## Where things stand (14 Nov 2026)

**Built:** the text pimp ladder; grading (a local matcher with Claude as a fallback, plus an eval set); personas; progression (rounds, shifts, rank, mastery); Home, the script picker, live session (text), list feedback, the result screen with the miss card, the clean run, Promotion, the illness script, the script collection and Progress; the "This is wrong" flag and its review queue; the PHI guard; the content pipeline; RLS with pgTAP tests. All 30 IM scripts are drafted and `in_review`, shown locally as "Not yet reviewed".

**M1.1 (varied questions):** every script has two questions per rung (all `in_review`). A session asks one per rung at random and avoids the last session's questions. "Pimp me" picks from the rotation, weighted toward missed and unseen scripts.

**M1.2 (mockup check):** every built screen matches its mockup in dark and light: type back to the DESIGN.md scale, spacing from the mockup CSS, persona order, "Change rotation" and long-press on Pimp me, the list feedback line, and the test fixtures hidden from students' screens.

**M1.3 (tab shell and Profile):** a tab bar with Pimp, Log, Review and Profile, hidden on session screens and the illness script. Progress is the Profile tab, matching `profile.png` (dark and light), with a Settings entry. Settings is a placeholder holding the daily goal. Log and Review show honest empty states. Tried on the phone. **Stage 1 is complete.**

**M2.1 (Log):** the Log tab matches `log.png` and wireframe 08. Autocomplete against script names and aliases; the patient-detail guard runs on every keystroke (names, titles, dates, 6+ digit numbers, phone numbers and the rest), turns the field coral, says exactly what to remove and turns Save off. A diagnosis with no matching script is saved under what was typed ("No script yet"). "Logged today" shows a pass dot and "Pimped, rung N" once a session on that script is finished today, otherwise a signal dot and "Not yet". Home has "From today's patients" with one-tap Start rows, "Log one" and the empty state. New `patient_logs` table (label, optional script, rotation, time; own rows only) with pgTAP tests. Tried on the phone.

**M2.2 (Review):** the Review tab matches `review.png`, `review-light.png` and wireframe 09. "Missed today" lists up to five scripts, oldest first; the rest roll to tomorrow, and a miss clears once a later ladder gets past the missed rung (or after a week). The line under each uses the miss card's label ("Missed on management"), or names the list items left out ("Missed uremia, salicylates"), kept to one line. Each row opens the script, whose back link then says "Review" (`script.png`). "You keep mixing these up" appears when the same pair was confused 2+ times in 7 days, with the comparison columns sliding in (video scene 7) and "Drill this pair": both scripts' Tell it apart questions, taking turns (up to 4), ending on the first miss, saved as a drill that never counts toward best rung, rounds, rank or mastery. "From today's patients" lists logged scripts not yet pimped today, with Start. The Anki row stays hidden until M3.1. New: `attempts.matched`, `ladder_sessions.kind` and `partner_script_id` (pgTAP tests); comparison rows on every `confused_with` pair (13 pairs, still `in_review`). Tried on the phone.

**M2.3 (accounts, onboarding, settings):** every student still starts without an account. Onboarding (wireframe 01) asks year and rotation, plus an optional "Week 3 of 8" row (not drawn), and shows whenever there's no profile yet, keeping the persona and goal a device already had. Home shows "Week 3 of 8" before "Change rotation", which now opens the same questions; the script picker is a link from there and still a long press on Pimp me. A rotation with no scripts yet (OB/GYN) says so and asks from the others. Settings (wireframe 12, no Anki): Daily goal above Voice (developer's call), Answer timeout (Persona default, 10 s, 30 s, 60 s, No limit), Appearance (Light, Dark, System, per device; replaces `EXPO_PUBLIC_THEME`), Account. Account (not drawn): sign in with a 6-digit email code (works from the phone on the home Wi-Fi; codes land in Mailpit locally), Sign in with Apple in the iPhone build only, sign out, delete account (`delete-account` Edge Function). Signing in adds the email or Apple ID to the same anonymous user, so history carries over; an email that already has an account signs in to it, after a warning if this phone has practice that stays behind. "Keep your progress" shows once on the result screen after the first session. New `profiles` table (pgTAP tests); persona and goal moved there from the device. Local auth now confirms emails, as a hosted project does. Tried on the phone.

**M2.4 (voice spike):** measured on a throwaway branch (`m2.4-voice-spike`, not merged). About 0.5 s from the end of speech to the next question is reachable when the local matcher grades. A Claude fallback adds 1.5–2.6 s, so M2.5 plays a short "thinking" cue on a matcher miss. Speech-to-text: Deepgram. Voice: ElevenLabs. Findings under M2.4 below.

**Gaps:** none in Stage 2 before voice.

**Next: M2.5 Voice session.**

## Screen map

| Screen | Wireframe | Mockup | Status | Milestone |
|---|---|---|---|---|
| Home (Pimp) | 02 | home, home-light | Matches (M1.2). From today's patients (M2.1). Week line and Change rotation (M2.3). Mic icon M2.5 | Done |
| Script picker | 03 | — | Matches wireframe (M1.2), reached by "Change rotation" or long-press on Pimp me. Filter chips: Parking lot | Done |
| Live session, text | 05 | session, session-light | Matches (M1.2); varied questions (M1.1) | Done |
| List feedback | 06 | list | Matches (M1.2), with the attending's line | Done |
| Result + miss card | 07 | result | Matches (M1.2). Anki row M3.1; flag link kept below progress. "Keep your progress" panel once, after the first session (M2.3, not drawn) | Done |
| Clean run | 13 | win, win-light | Matches (M1.2). Keeps "Next topic"; light "Script mastered" badge text needs a dark-amber token | Done |
| Promotion | 14 | promo | Matches (M1.2) | Done |
| Illness script | 10 | script | Matches (M1.2). Back link says "Review" when opened from Review (M2.2). Mic icon M2.5 | Done |
| Script collection | 15 | collection, collection-light | Matches (M1.2) | Done |
| Profile | 11 | profile, profile-light | Matches (M1.3): the Profile tab, titled Progress, with a Settings row. Teams row: Stage 5 | Done |
| Tab bar (Pimp, Log, Review, Profile) | — | all tab screens | Built (M1.3). Shown on Home, topic picker, Log, Review, Profile, collection, Settings; hidden on session screens and the illness script | Done |
| Log | 08 | log | Matches (M2.1). Subtitle shows the rotation only until scripts have a system field | Done |
| Review + mix-up drill | 09 | review, review-light | Matches (M2.2). Drill screens reuse the session and result pieces (not drawn). Anki row M3.1 | Done |
| Onboarding | 01 | — | Built (M2.3), plus an optional week row. Also used by Change rotation. MS1–2 systems: Stage 5 | Done |
| Settings | 12 | — | Built (M2.3): daily goal, answer timeout, appearance, account. Voice speed M2.5, Anki part M3.1 | Done |
| Account | — | — | Built (M2.3, not drawn): email code, Apple (iPhone build), sign out, delete | Done |
| Live session, voice | 04 | session | Not built | M2.5 |
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
| Deepgram Aura-2, voiced live | 2.2–3.1 / 3.3 s | 2.0–2.9 / 3.3 s |
| ElevenLabs Flash v2.5, voiced live | 0.92 / 1.63 s | 0.69 / 0.73 s |

- **Grading decides it.** The matcher's round trip is about 65 ms. When it misses, the Claude fallback brings the whole turn to 2.0 s with Haiku 5.5 (worst 2.5 s) and 2.5 s with Opus 5.5 (worst 3.1 s), whichever speech vendor is used. So ~1 s holds only for answers the matcher grades.
- **Fallback for M2.5:** on a matcher miss, play a short cached "thinking" cue at once (the attending's "mm-hm"), then the next question when the grade arrives. Push to talk only saves the 0.3–0.6 s of waiting for silence, so it doesn't fix this.
- **Recommendation:** Deepgram for speech-to-text (steadier worst case, and it cut off fewer answers), ElevenLabs for the voice (live follow-ups start in about 0.25 s; Deepgram's mp3 took 1.4–3.3 s to start in the browser). Both sit behind the `stt` and `tts` interfaces, so this can change.
- **Spending caps (developer, 14 Nov):** $10 per speech vendor. The spike's speech cost was well under that.

**Notes for the M2.5 plan (from M2.4):**
- End the turn with our own silence check, not the vendor's: it saved about 0.2 s. 300 ms of silence is too short for list questions and for anyone who pauses mid-answer: it cut answers off ("I'd say the pancreas is inflamed" lost "from the alcohol"). Try a longer wait on list questions, and only end the turn once the speech has really stopped.
- Both vendors misheard "ALT" (as "A" and "LT"), which sent the answer to Claude and once graded it wrong. Pass the question's accepted answers to the vendor as expected words (both support this).
- Before switching the grader to Haiku for speed, check its grading with `pnpm eval:grading --model claude-haiku-5-5` (billed: the developer's OK first).
- Deepgram needs an API key with the Member role to issue the browser's short-lived tokens.
- Trying voice on the phone needs HTTPS for both the app and Supabase (Safari's mic rule), or an EAS development build. Decide which before M2.5's phone check.
- Keep the streaming connection open and the next question's audio ready before the student speaks; the spike measured with both ready.

### M2.5 Voice session
- Wireframe 04 and `session.png`: an idle dotted waveform while the attending asks, live once the question ends. Common questions use cached audio. Everything sits behind the `stt` and `tts` provider interfaces. Text mode stays available everywhere.
- **Mic icon** on "Pimp me" (Home) and "Pimp me on this" (illness script), as in `home.png` and `script.png`. M1.2 kept the ladder icon because the app was text-only.
- **Voice speed** row in Settings → Voice (wireframe 12), left out in M2.3 because there was no voice yet.

### M2.6 Hosting and TestFlight
- A hosted Supabase project, Edge Functions with a spending cap on the API key, an EAS build and TestFlight. The developer has no Mac, so cloud builds only.
- **Accounts on the hosted project (from M2.3):** keep "Confirm email" on, turn on anonymous sign-ins and manual linking, use code email templates like `supabase/templates/`, deploy `delete-account`, and set up real email sending (SMTP).
- **Sign in with Apple (developer setup):** Apple Developer Program membership; bundle id `com.ben.rounds` (in `app.json`, with `usesAppleSignIn`); EAS switches on the capability during the cloud build; in the hosted Supabase project, Authentication → Providers → Apple with `com.ben.rounds` as a client id (no secret needed for the native flow). Try it on the first TestFlight build: the web app doesn't offer Apple.
- **Release rule:** a build that people other than the developer and the reviewer can use shows only `approved` scripts. Before M2.6, decide how the developer tests on a hosted backend while scripts are still in review. One option is a separate private dev project that's allowed to use the preview. That would change domain rule 2, which today says the preview flag is never set on a hosted database, so it needs the developer's explicit OK.

---

## Stages 3–5 (detail added when Stage 2 is done)
- **3. Anki bridge:** M3.1, the add-on and the Anki section of Settings (wireframe 12), prototyped against a real AnKing collection. Includes the "Unsuspend 3 Anki cards" row on the result screen (`result.png`), left out until then.
- **4. Launch:** public web portal, marketing site (copy follows DESIGN.md → Voice and copy), payments, Android.
- **5. Expand:** all rotations, shadowing mode (including organ systems instead of rotations for MS1–2 in onboarding, wireframe 01 note 1; scripts need a "system" field first), Teams (mockups and wireframes 16–18 are ready), desktop decision, school licenses.

## Decisions for the developer (not Code)
- **Review at scale:** who reviews scripts for rotations other than IM. This is needed before a public release, not before building.
- **Name and button label** ("Pimp me" or "Ask me"): decide before anyone outside the household sees it.
- **Spending caps** for grading, speech and hosting: speech set at $10 per vendor (14 Nov 2026). Grading and hosting caps still needed by M2.6.
- **Hosted dev preview** (see M2.6).

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
- (14 Nov 2026) Revisit after beta testing (developer, M2.3): more onboarding questions; where the daily goal lives (Settings for now); signing in to an existing account from a phone with practice on it.

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
