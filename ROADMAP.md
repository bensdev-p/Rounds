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

## Where things stand (13 Nov 2026)

**Built:** the text pimp ladder; grading (a local matcher with Claude as a fallback, plus an eval set); personas; progression (rounds, shifts, rank, mastery); Home, the script picker, live session (text), list feedback, the result screen with the miss card, the clean run, Promotion, the illness script, the script collection and Progress; the "This is wrong" flag and its review queue; the PHI guard; the content pipeline; RLS with pgTAP tests. All 30 IM scripts are drafted and `in_review`, shown locally as "Not yet reviewed".

**M1.1 (varied questions):** every script has two questions per rung (all `in_review`). A session asks one per rung at random and avoids the last session's questions. "Pimp me" picks from the rotation, weighted toward missed and unseen scripts.

**M1.2 (mockup check):** every built screen matches its mockup in dark and light: type back to the DESIGN.md scale, spacing from the mockup CSS, persona order, "Change rotation" and long-press on Pimp me, the list feedback line, and the test fixtures hidden from students' screens.

**Gaps:** there's no tab bar, Log, Review, onboarding or settings yet. Progress is a pushed screen and needs to become the Profile tab.

## Screen map

| Screen | Wireframe | Mockup | Status | Milestone |
|---|---|---|---|---|
| Home (Pimp) | 02 | home, home-light | Matches (M1.2). Week line M2.3, today's patients M2.1, mic icon M2.5 | Done |
| Script picker | 03 | — | Matches wireframe (M1.2), reached by "Change rotation" or long-press on Pimp me. Filter chips: Parking lot | Done |
| Live session, text | 05 | session, session-light | Matches (M1.2); varied questions (M1.1) | Done |
| List feedback | 06 | list | Matches (M1.2), with the attending's line | Done |
| Result + miss card | 07 | result | Matches (M1.2). Anki row M3.1; flag link kept below progress | Done |
| Clean run | 13 | win, win-light | Matches (M1.2). Keeps "Next topic"; light "Script mastered" badge text needs a dark-amber token | Done |
| Promotion | 14 | promo | Matches (M1.2) | Done |
| Illness script | 10 | script | Matches (M1.2). Mic icon M2.5 | Done |
| Script collection | 15 | collection, collection-light | Matches (M1.2) | Done |
| Profile | 11 | profile, profile-light | Partial (`progress`, not a tab) | M1.3 |
| Tab bar (Pimp, Log, Review, Profile) | — | all tab screens | Not built | M1.3 |
| Log | 08 | log | Not built | M2.1 |
| Review + mix-up drill | 09 | review, review-light | Not built | M2.2 |
| Onboarding | 01 | — | Not built | M2.3 |
| Settings | 12 | — | Not built | M2.3 (Anki part: M3.1) |
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

**Stage 1 is complete when M1.3 is done.**

---

## Stage 2 — iPhone beta

### M2.1 Log
- Matches `log.png` and wireframe 08: diagnosis label, rotation and date only. The PHI guard blocks and explains, as in video scene 6.
- Labels map to scripts where one exists. A log with no matching script is still saved.
- **Home, "From today's patients"** (`home.png`, wireframe 02 note 3): today's logs as one-tap Start rows, a "Log one" link, and the empty state "Log a patient to practise on them tonight." Left out in M1.2 because there was no Log yet.

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

### M2.5 Voice session
- Wireframe 04 and `session.png`: an idle dotted waveform while the attending asks, live once the question ends. Common questions use cached audio. Everything sits behind the `stt` and `tts` provider interfaces. Text mode stays available everywhere.
- **Mic icon** on "Pimp me" (Home) and "Pimp me on this" (illness script), as in `home.png` and `script.png`. M1.2 kept the ladder icon because the app was text-only.

### M2.6 Hosting and TestFlight
- A hosted Supabase project, Edge Functions with a spending cap on the API key, an EAS build and TestFlight. The developer has no Mac, so cloud builds only.
- **Release rule:** a build that people other than the developer and the reviewer can use shows only `approved` scripts. Before M2.6, decide how the developer tests on a hosted backend while scripts are still in review. One option is a separate private dev project that's allowed to use the preview. That would change domain rule 2, which today says the preview flag is never set on a hosted database, so it needs the developer's explicit OK.

---

## Stages 3–5 (detail added when Stage 2 is done)
- **3. Anki bridge:** M3.1, the add-on and the Anki section of Settings (wireframe 12), prototyped against a real AnKing collection. Includes the "Unsuspend 3 Anki cards" row on the result screen (`result.png`), left out until then.
- **4. Launch:** public web portal, marketing site (copy follows DESIGN.md → Voice and copy), payments, Android.
- **5. Expand:** all rotations, shadowing mode, Teams (mockups and wireframes 16–18 are ready), desktop decision, school licenses.

## Decisions for the developer (not Code)
- **Review at scale:** who reviews scripts for rotations other than IM. This is needed before a public release, not before building.
- **Name and button label** ("Pimp me" or "Ask me"): decide before anyone outside the household sees it.
- **Spending caps** for grading, speech and hosting: needed by M2.4.
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

---

## Prompt to start a milestone in Claude Code
```
Read ROADMAP.md, CLAUDE.md, docs/PRODUCT.md and docs/design/DESIGN.md.
We're on milestone <M1.1>. Open the wireframes and mockups for every screen
it touches. Plan only this milestone: the changes, files and tests, and how
you'll meet the Definition of done. Show me the plan before editing.
Anything outside this milestone goes in ROADMAP.md → Parking lot.
```
