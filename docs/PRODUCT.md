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

### The miss card
**Status: built** (result screen).

When a session ends on a miss, the result screen explains that miss in one card, as on `docs/design/png/mockups/result.png` and in the vision video (scene 4):
- A label naming the rung: "Missed on management".
- One sentence that quotes what the student said next to what the script says: "You said "keep them NPO until the pain resolves." Early oral feeding, as tolerated, is preferred in mild disease."
- A "Review the script" link to that script.

Rules:
- The correction is taken from the approved script field the question was built on (domain rule 1). The AI may phrase the sentence; it never supplies the fact.
- The quote is the student's own answer for that question. It is free text, so it goes through the same PHI guard as other free-text input before it is stored or shown.
- List questions keep their own feedback (got and missed pills); the card is for the miss that ends a session.
- No card on a clean run.

A possible extension, not decided: open the next session on the same script with the missed question.

## Supporting features (minor, mostly automatic)
- **Mix-up detector:** repeated `confused_with` misses between two scripts → a side-by-side comparison drill.
- **Weakness map:** by rotation, system and script, from ladder results and Anki data.
- **Learn from today's patients:** a logged diagnosis → that evening, its script, a short ladder and its Anki cards.

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
Stages are defined by what's built, not by testing windows or content approval. The developer tests as he goes. The milestones and their order are in `ROADMAP.md`.
1. **Prototype (local):** text pimp ladder with varied questions; ~30 internal medicine scripts (drafted; review can come later); local Supabase; web dev build; every built screen matches its mockup.
2. **iPhone beta:** the tab shell, Log, Review, accounts and onboarding, voice pimp; EAS build on TestFlight.
3. **Anki bridge:** add-on and automatic miss tagging.
4. **Launch:** public web portal, marketing site, payments (Stripe on web, RevenueCat in-app), Android when ready.
5. **Expand:** all rotations, shadowing mode, Teams, desktop decision, school licenses.

Content review runs alongside development and never blocks it. It is a release requirement only: anyone other than the developer and the reviewer sees only `approved` scripts (domain rule 2).

## Later / maybe
Oral presentation coach · virtual patients · crowdsourced rotation guides · polished Anki review tab.

## Name
Working name **Rounds**. Use "Pimp me" as the in-app button label, not the brand.

## Recommendations (not decided)
Suggestions that came out of making the vision video (November 2026). **None of these are requirements.** Don't build or design toward them unless the developer says so; raise them when the related work comes up.

- **Sell the morning.** The moment students dread is being asked on morning rounds. A three-minute warm-up on yesterday's logged patients, before rounds, may be a stronger habit than the evening review. The video's line for this is "Get asked here first."
- **Show the reviewer in the session.** "Reviewed by Dr. J. Patel, PGY-3" currently appears only on the script page. Showing it with the question is the reason to trust Rounds over a general chatbot.
- **Revisit the word "pimp".** The Name section keeps it on the button only, and VIDEO.md bans it from marketing. Some schools treat the practice as mistreatment, so the button label may matter for school licenses (Stage 5). "Ask me" is the neutral option.
