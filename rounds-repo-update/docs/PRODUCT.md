# Rounds — Product Spec

## One-liner
A voice-first trainer that quizzes ("pimps") medical students the way attendings do on rounds. It's built on structured illness scripts, connects to Anki, and ties study back to the real patients students see.

## Users
- **Primary:** third- and fourth-year students on clinical rotations.
- **Secondary:** first- and second-year students (pre-clinical, shadowing). They get a "shadowing mode" with basic-science questions.
- **Design partner:** one med student (the developer's fiancée), plus her classmates in the beta.

## The daily routine (the whole app is these three tabs)
1. **Pimp** (morning, ~5 min): a voice session on today's rotation or a logged patient.
2. **Log** (during the day, ~10 sec): record a patient by diagnosis label only.
3. **Review** (evening): misses, the related illness scripts, and the matching Anki cards.

Everything else (stats, weakness map, mix-up pairs, settings) lives in a single **Profile** screen.

## Core entity: the illness script
A disease's structured summary. Fields:
- `id`, `name`, `aliases[]`, `rotation[]` (IM, surgery, peds, OB/GYN, psych, neuro, FM, EM)
- `epidemiology`: who gets it, risk factors
- `pathophysiology`: short mechanism
- `timeline`: onset and course
- `key_findings`: history, exam, labs, imaging (each a list)
- `diagnosis`: confirmatory test(s), criteria
- `management`: first-line and next-line treatment
- `complications[]`
- `confused_with[]`: links to other scripts, each with a "how to tell apart" note
- `pearls[]`: high-yield facts attendings like to ask
- `difficulty_tiers`: which facts are MS1–2 / MS3 / MS4 level
- `anki_refs[]`: external AnKing card/note IDs (IDs only, never card text)
- `status`, `version`, `reviewed_by`, `reviewed_at`, `sources[]`

Scripts are drafted by AI and approved by a human medical reviewer. Each question has a "This is wrong" flag that feeds a review queue.

## The pimp ladder
- Each session picks a script (or a rotation and lets the app choose).
- Questions climb rungs: recall → second-order ("what's next most common?") → differentiate ("how do you tell it from X?") → workup → management → pearl.
- Session ends on the first miss. Score = the rung reached. Track best rung per script.
- **List questions:** "Name 5 causes of…", graded with partial credit, showing the ones missed.
- **Attending personas:** Teacher (patient, hints), Surgeon (rapid-fire, short time limit), Internist (Socratic, "why?"). Same content, different pacing and tone.
- **Automatic miss tags:** `unknown`, `slow`, `partial_list`, `confused_with:<script_id>`.
- **Grading:** the AI compares the student's answer to the script's accepted answers and synonyms, and returns `correct | partial | incorrect` plus a one-line reason. It never grades against facts outside the script.

## Supporting features (minor, mostly automatic)
- **Mix-up detector:** repeated `confused_with` misses between two scripts → a side-by-side comparison drill.
- **Weakness map:** by rotation, system and script, from ladder results and Anki data.
- **Learn from today's patients:** a logged diagnosis → that evening, its script, a short ladder and its Anki cards.

## Progression
Light gamification built on rungs. Full rules and visuals: `docs/design/DESIGN.md` → Progression.
- **Today's rounds:** a daily goal of N sessions (default 3, range 1–5).
- **Shifts:** consecutive days with rounds finished. One automatic post-call day per week. No streak-loss messaging.
- **Rank:** MS3 (0) → Sub-I (150) → Intern (500) → Resident (1,200) → Chief (2,500) → Attending (5,000) total rungs. Never decreases. One full-screen promotion per rank.
- **Mastery:** rung 6 on two different days. Re-check due after 30 days.
- **Badges:** Clean run, New best, Script mastered. Nothing else.
- **Teams (Stage 5, opt-in):** invite-only groups of up to 12. A shared weekly rung goal, a weekly list sorted by rungs, and one-script challenges. Shares only first name, rank, weekly rungs and rounds days; never misses, weak spots, scripts or logged patients. Details: `docs/design/DESIGN.md` → Teams.

Data model notes: store each session (`script_id`, `persona`, `rung_reached`, `clean`, `started_at`, `miss_tag`). Derive rounds, shifts, rank and mastery from sessions rather than storing counters, so the numbers can't drift.

## Anki bridge (Stage 3)
A Python Anki add-on that:
- signs in to the user's Rounds account,
- uploads review statistics for cards that have `anki_refs`,
- downloads actions: unsuspend card IDs, add tag `#Rounds::missed`,
- never uploads card content.

## Platforms
| Platform | Approach | When |
|---|---|---|
| iPhone | Expo + EAS cloud build, TestFlight → App Store | Stage 2 |
| Web app | Expo web | Stage 1 (dev), public at Stage 4 |
| Android | Same Expo codebase | Stage 4 or later |
| Marketing site | Next.js | Stage 4 |
| Desktop | Browser / PWA for now; decide later | Later |

## Voice pipeline (Stage 2)
Speech-to-text (streaming) → Edge Function grades the answer and sends the pre-queued next question → text-to-speech (streaming).
- Target: ≤ ~1 s from end of the student's speech to the start of the next question.
- Pre-generate and cache audio for common script questions. Only follow-ups are spoken live.
- Text mode is always available.
- Provider interface so the speech and voice vendors can be swapped.

## Privacy & safety
- No patient data (PHI): the log is a diagnosis label plus rotation and date. Warn on and block name, DOB, MRN, phone or address patterns.
- "Educational use only, not clinical guidance" disclaimer.
- Never store or redistribute AnKing card text or Qbank questions.

## Build stages
1. **Prototype (local):** text pimp ladder; ~30 approved internal medicine scripts; local Supabase; web dev build. Success = the design partner uses it 5 days in a row unprompted.
2. **iPhone beta:** voice pimp, log, review; accounts; TestFlight with ~20–50 classmates.
3. **Anki bridge:** add-on and automatic miss tagging.
4. **Launch:** public web portal, marketing site, payments (Stripe on web, RevenueCat in-app), Android when ready.
5. **Expand:** all rotations, shadowing mode, teams and challenges, desktop decision, school licenses.

## Later / maybe
Oral presentation coach · virtual patients · crowdsourced rotation guides · polished Anki review tab.

## Name
Working name **Rounds**. Use "Pimp me" as the in-app button label, not the brand.
