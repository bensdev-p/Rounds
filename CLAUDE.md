# CLAUDE.md — Rounds

Rounds is a voice-first "pimping" trainer for medical students. It quizzes students the way attendings do on rounds: rapid, escalating, out loud. All content is built on structured **illness scripts**. Full product spec: `docs/PRODUCT.md`. Read it before starting any feature.

## Current stage

**Stage 1: Prototype (local).** A text-only pimp ladder, with ~30 internal medicine illness scripts, tested by one med student.
Do not build anything from later stages unless asked: voice, payments, Android release, Anki bridge, marketing site.

## Stack

- **Monorepo:** pnpm workspaces + Turborepo
- **apps/mobile:** Expo (React Native) + Expo Router + TypeScript. Also serves the web app (Expo web). iPhone first; Android ships later from the same code.
- **apps/site:** Next.js marketing site (Stage 4, not yet)
- **packages/shared:** TypeScript types, Zod schemas (illness script, question, attempt), API client, pure grading/ladder logic
- **packages/anki-addon:** Python Anki add-on, the "bridge" (Stage 3, not yet)
- **supabase/:** Postgres migrations, Row Level Security policies, Edge Functions (Deno/TypeScript) for all AI calls
- **AI:** Claude API, called only from Supabase Edge Functions. Never ship API keys to the client.
- **Builds:** EAS cloud builds. The developer has no Mac, so never suggest local Xcode steps.

## Commands

pnpm comes from corepack (version pinned in root `package.json`).
- `pnpm install`
- `pnpm dev`: run the mobile app in web mode (http://localhost:8081)
- `pnpm test`: unit tests (Vitest)
- `pnpm typecheck` and `pnpm lint`
- `pnpm format`: Prettier (code only; Markdown is left alone)
- `pnpm db:start` / `pnpm db:reset`: local Supabase (needs Docker Desktop running)
- `pnpm db:test`: pgTAP tests in `supabase/tests` (RLS)
- `pnpm db:types`: regenerate `packages/shared/src/db/database.types.ts` after a migration
- `pnpm content:seed`: validate content and regenerate `supabase/seed.sql` (then `pnpm db:reset`)
- `pnpm test:integration`: API client tests against the local Supabase stack (needs `pnpm db:start`)
- `apps/mobile/.env.local` holds the local Supabase URL and publishable key (see `.env.example`)
- Add Expo packages with `pnpm expo install <pkg>` from `apps/mobile`, so versions match the SDK.

## Core domain rules

1. **The illness script is the source of truth.** Every question, every accepted answer and every grading rubric must trace to fields in an approved script. The AI never invents medical facts at runtime.
2. **Script status:** `draft` → `in_review` → `approved` → `retired`. Only `approved` scripts are used for pimping. Every approved script records `reviewed_by` and `reviewed_at`.
3. **The pimp ladder** escalates until the student misses, then ends. Score = the rung reached. Partial credit applies to list questions ("name 5 causes").
4. **Miss tagging is automatic:** `unknown`, `slow`, `partial_list`, `confused_with:<script_id>`. The user never fills in a form.
5. **No patient data (PHI), ever.** The patient log stores a diagnosis label, rotation and date only. Free-text inputs must warn on, and block, anything resembling names, dates of birth, medical record numbers, phone numbers or addresses. Do not add fields that could hold patient details.
6. **Licensed content:** never store or reproduce AnKing card text or Qbank questions. Reference them by external ID only.

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
