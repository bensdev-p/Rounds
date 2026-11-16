# CLAUDE.md — Rounds

Rounds is a voice-first "pimping" trainer for medical students. It quizzes students the way attendings do on rounds: rapid, escalating, out loud. All content is built on structured **illness scripts**. Full product spec: `docs/PRODUCT.md`. Read it before starting any feature.

## Current stage

**Read `ROADMAP.md` first.** It sets the order of work and the current milestone. Work on one milestone at a time; anything outside it goes in ROADMAP.md → Parking lot, not in code.

**Stage 3: Anki bridge.** Stage 1 (local text prototype, tab shell) was completed on 14 Nov 2026 and Stage 2 (Log, Review, accounts, voice, hosting and TestFlight) on 15 Nov 2026. Stage 3 connects Rounds to the student's Anki through a desktop add-on, in the milestone order in ROADMAP.md.
Do not build anything from later stages unless asked: payments, Android release, marketing site, public web portal, Teams. Text mode stays available everywhere.
The app runs against the private hosted project `rounds-dev` on TestFlight (`docs/HOSTING.md`) and against the local stack via `pnpm start`. Anki add-ons run only in Anki on a computer (Windows, macOS, Linux), not in AnkiMobile on the iPhone.
Content review and user testing are not gates: development doesn't wait for scripts to be approved or for a testing period. The developer tests as he goes.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **apps/mobile:** Expo (React Native) + Expo Router + TypeScript. Also serves the web app (Expo web). iPhone first; Android ships later from the same code.
- **apps/site:** Next.js marketing site (Stage 4, not yet)
- **packages/shared:** TypeScript types, Zod schemas (illness script, question, attempt), API client, pure grading/ladder logic
- **packages/anki-linker:** developer-only Anki add-on that proposes AnKing note links per script and rung (M3.2). Never shipped to students.
- **packages/anki-addon:** the student's Python Anki add-on, the "bridge" (M3.3). It talks to Supabase only through the `anki-pair` and `anki-sync` Edge Functions with a device token, never with a Supabase key, and never reads or uploads card text.
- **supabase/:** Postgres migrations, Row Level Security policies, Edge Functions (Deno/TypeScript) for all AI calls
- **AI:** Claude API, called only from Supabase Edge Functions. Never ship API keys to the client.
- **Builds:** EAS cloud builds. The developer has no Mac, so never suggest local Xcode steps.

## Commands

pnpm comes from corepack (version pinned in root `package.json`).
- `pnpm install`
- `pnpm dev`: run the mobile app in web mode (http://localhost:8081)
- `pnpm start`: the everyday command. Checks Docker, starts the database, the grading server and the web app, and prints the address for a phone on the home Wi-Fi
- `pnpm phone`: same, and prints the address to open on a phone on the home Wi-Fi (needs `pnpm db:start`; `pnpm functions:serve` for Claude grading)
- `pnpm test`: unit tests (Vitest)
- `pnpm typecheck` and `pnpm lint`
- `node apps/mobile/scripts/make-icons.mjs`: redraw the app icon (home-screen, favicon) from the tokens
- `pnpm format`: Prettier (code only; Markdown is left alone)
- `pnpm db:start` / `pnpm db:reset`: local Supabase (needs Docker Desktop running)
- `pnpm db:test`: pgTAP tests in `supabase/tests` (RLS)
- `pnpm db:types`: regenerate `packages/shared/src/db/database.types.ts` after a migration
- `pnpm content:check`: validate every script in `content/scripts` (drafts included; also part of `pnpm test`)
- `pnpm content:review`: write review sheets for unapproved scripts to `content/review/` (gitignored)
- `pnpm content:approve <id> --by "Name, role"`: record a medical reviewer's approval. Only on the reviewer's explicit sign-off; never run it yourself. See `content/README.md`
- `pnpm stats`: usage report per student on the local database: days used, days in a row, sessions, rungs, flags, last 14 days (`--all` includes test accounts)
- `pnpm anki:linker:install`: copy the Rounds linker add-on into Anki on this computer (restart Anki; Tools → Rounds: link scripts). `pnpm content:link-anki <links.json> [--dry-run]`: write the links it saved into `content/scripts` as `anki_refs` (ids and rungs only)
- `pnpm anki:addon:install`: copy the student add-on into Anki on this computer, pointed at the local stack (restart Anki; Tools → Rounds). `pnpm anki:addon:build [--hosted]`: pack it as a `.ankiaddon` in `packages/anki-addon/dist` (local stack, or `rounds-dev` with `--hosted`). `pnpm anki:test` runs both add-ons' Python tests
- `pnpm anki:queue <script-id> [rung] [--tag]`: queue an unsuspend (or `#Rounds::missed` tag) action on the local database for the most recently connected Anki, without playing a session (the result screen's row and automatic miss tags do the same, M3.4)
- `pnpm content:flags`: list the "This is wrong" flags students sent, by script and question (local database)
- `pnpm content:seed`: regenerate `supabase/seed.sql` from the test fixtures plus approved scripts (then `pnpm db:reset`)
- `pnpm content:push [--preview] [--dry-run]`: send approved and in-review scripts (never fixtures or drafts) to the linked hosted project. Changes hosted data: get the developer's OK first
- Hosting and TestFlight (hosted Supabase, deploying functions, store builds, `eas submit`): see `docs/HOSTING.md`. Deploys, pushes and builds change hosted services: get the developer's OK first
- `pnpm functions:serve`: run Edge Functions locally. Reads `supabase/functions/.env` (gitignored; copy `.env.example` and add `ANTHROPIC_API_KEY`). Without a key, grading is local only.
- `pnpm functions:serve:fake`: the same, with a fake model and fake speech that spend nothing
- Voice on the iPhone runs in an EAS development build (cloud build, no Mac): see `docs/PHONE.md`. `DEEPGRAM_API_KEY` in `supabase/functions/.env` turns voice on; speech is billed, so get the developer's OK before paid runs
- `pnpm functions:check`: Deno type-check of the Edge Functions (also run by `pnpm typecheck`)
- `pnpm eval:grading --dry-run`: validate the grading eval cases for free. Without `--dry-run` it calls Claude and is billed: get the developer's OK first. `--model claude-haiku-5-5` compares models
- `pnpm test:integration`: API client and `grade-answer` tests against the local stack (needs `pnpm db:start` and `pnpm functions:serve:fake`). Afterwards restart `pnpm functions:serve` (or `pnpm start`): the fake server keeps running in Docker, and the app would hear tones instead of the attending
- `pnpm --filter video studio`: preview the vision video. `pnpm --filter video render`: export both MP4s and posters to `apps/video/out` (gitignored)
- `apps/mobile/.env.local` holds the local Supabase URL and publishable key (see `.env.example`)
- The app is dark by default. To check light mode, switch Profile → Settings → Appearance (per device).
- Local emails (sign-in codes) land in Mailpit: http://127.0.0.1:54324. Sign in with Apple works only in the iPhone build.
- Add Expo packages with `pnpm expo install <pkg>` from `apps/mobile`, so versions match the SDK.
- `packages/shared` uses explicit `.ts` extensions on relative imports, so Edge Functions (Deno) can import it directly.

## Core domain rules

1. **The illness script is the source of truth.** Every question, every accepted answer and every grading rubric must trace to fields in an approved script. The AI never invents medical facts at runtime.
2. **Script status:** `draft` → `in_review` → `approved` → `retired`. Only `approved` scripts are used for pimping. Every approved script records `reviewed_by` and `reviewed_at`.
   - **Preview (developer's decisions, 2026-11-13 and 2026-11-14):** `in_review` scripts may also be shown, labelled "Not yet reviewed", but only where `app_settings.show_in_review` is on. Only the local seed and `pnpm content:push --preview` turn it on, and the push allows it only for projects in `supabase/hosting.json` → `previewProjects`: the private dev project that only the developer and the reviewer use (TestFlight internal testing). Never turn it on for a project anyone else's build points at. Drafts are never shown.
3. **The pimp ladder** escalates until the student misses, then ends. Score = the rung reached. Partial credit applies to list questions ("name 5 causes").
4. **Miss tagging is automatic:** `unknown`, `slow`, `partial_list`, `confused_with:<script_id>`. The user never fills in a form.
5. **No patient data (PHI), ever.** The patient log stores a diagnosis label, rotation and date only. Free-text inputs must warn on, and block, anything resembling names, dates of birth, medical record numbers, phone numbers or addresses. Do not add fields that could hold patient details.
6. **Licensed content:** never store or reproduce AnKing card text or Qbank questions. Reference them by external ID only.

## Design

Visual guidance lives in `docs/design/`. Read `docs/design/DESIGN.md` before building any UI.
- **The mockups, wireframes and vision video are finished, and they are the target.** The app must match them. Don't edit `docs/design/` or `apps/video` unless the developer asks. If the app and a mockup disagree, change the app. If a mockup seems wrong or can't be built as drawn, stop and ask rather than diverging.
- Structure and behaviour: `docs/design/png/wireframes/` (18 screens with numbered notes; 16–18 are the later-stage Teams feature).
- Look and feel: `docs/design/png/mockups/` (14 in dark mode, 7 in light).
- Gamification rules (rounds, shifts, rank, mastery) are in DESIGN.md → Progression. Don't add mechanics beyond those. Teams is Stage 5: don't build it before then.
- Theme values come only from `docs/design/tokens.json` → `packages/shared/theme` (a test keeps them in sync). No raw hex in components.
- App building blocks live in `apps/mobile/src/ui/` (text styles, buttons, ladder, progress pieces). Reuse them before adding new ones.
- Fonts: Archivo and Archivo Narrow via `@expo-google-fonts`. Icons: `lucide-react-native`.
- When building a screen, open its PNG and match it. If something's unclear, follow DESIGN.md rather than inventing a new pattern.
- The vision video (`apps/video`, Remotion) is specified in `docs/design/VIDEO.md`. It shows one session end to end; DESIGN.md → "The session, start to finish" turns that into rules for the app.
- `apps/video/src/screens/` holds seven screens already recreated in web React from the tokens. Use them as a worked reference when building the real screens; don't import them into the app.
- Session content in the video lives in `apps/video/src/session.ts`. Its questions and answers trace to the script mockup, so keep domain rule 1 in mind when editing it.

## Planned and proposed

- **The miss card** is built (result screen); its rules are in `docs/PRODUCT.md` → "The miss card".
- **Recommendations:** `docs/PRODUCT.md` → "Recommendations (not decided)" lists ideas that are not requirements. Don't build toward them unless asked.

## Code conventions

- TypeScript strict mode. No `any` without a comment explaining why.
- Validate every API/DB boundary with the Zod schemas in `packages/shared`.
- Pure logic (ladder progression, scoring, miss classification) lives in `packages/shared` with unit tests. UI stays thin.
- Database changes are made only through migrations in `supabase/migrations`. Every table has RLS enabled, and users can read and write only their own rows.
- AI prompts live in `supabase/functions/_prompts/` as versioned files, not inline strings.
- Keep AI calls behind a provider interface (`llm`, `stt`, `tts`) so vendors can be swapped.
- Accessibility: every interactive element has a label. Support Dynamic Type and dark mode.

## Workflow

- For any change touching more than ~3 files, plan first and show the plan before editing.
- Write or update tests alongside logic changes. Run `pnpm typecheck && pnpm test` before declaring done.
- Small, focused commits with clear messages.
- If a requirement seems to conflict with the domain rules above, stop and ask.
