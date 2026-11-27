# Hosting and TestFlight

Rounds runs on one hosted Supabase project and ships to the iPhone through TestFlight. No Mac is needed: builds run in the cloud (EAS).

## The release rule

- **Today there is one hosted project, `rounds-dev`. It is private.** Only the developer and the medical reviewer use it, through TestFlight *internal* testing (people added as users in App Store Connect). It shows `in_review` scripts, labelled "Not yet reviewed" (developer's decision, 14 Nov 2026; domain rule 2).
- **Anyone else gets a build only from a separate production project** that shows `approved` scripts only. That project doesn't exist yet (ROADMAP → Parking lot).
- `supabase/hosting.json` → `previewProjects` lists the projects allowed to show the preview. `pnpm content:push --preview` refuses any other project.

## Once

All commands run from the repo root unless a step says otherwise. Sign-ins, passwords, billing and Apple credentials are the developer's.

### 1. Supabase project
1. At supabase.com, create a project named `rounds-dev` on the **Free plan** (no billing). Choose a region near you and save the database password in your password manager.
2. Link this repo to it (asks for the database password):
   ```bash
   pnpm supabase login
   ```
   ```bash
   pnpm supabase link
   ```
3. Put the project ref (the `xxxx` in `https://xxxx.supabase.co`) in `supabase/hosting.json` → `previewProjects`, and commit it.

### 2. Database, auth settings, functions
```bash
pnpm supabase db push
```
Creates the tables, RLS policies and the private `voice-cache` bucket. It never runs `seed.sql` (that holds test fixtures).
```bash
pnpm supabase config diff
```
```bash
pnpm supabase config push
```
Sends the auth settings from `supabase/config.toml`: "Confirm email" on, anonymous sign-ins, manual linking (for Apple), the 6-digit code email templates, and Sign in with Apple with `com.ben.rounds` as the client id. The `[remotes.rounds-dev]` block at the end of `config.toml` keeps the hosted project's own pooler and storage settings, a 60 s gap between code emails, no localhost redirect, and Resend for the code emails (section 4; needs `supabase/.env`). Read the diff before saying yes.
```bash
pnpm supabase secrets set ANTHROPIC_API_KEY=... DEEPGRAM_API_KEY=... GRADER_MODEL=claude-opus-5-5
```
Type the keys yourself; never paste them into a chat. `DEEPGRAM_API_KEY` needs the Member role.
```bash
pnpm supabase functions deploy
```
Deploys `grade-answer`, `delete-account`, `speak`, `speech-token`, `anki-pair` and `anki-sync`. Supabase provides `SUPABASE_URL` and the keys they read. The two Anki functions run with the gateway's JWT check off (`supabase/config.toml`), because the add-on sends a pairing code or device token instead; they check callers themselves.

### 3. Spending caps
- **Anthropic** (grading): in the Anthropic Console, set a monthly spend limit on the workspace that owns the key.
- **Deepgram** (speech): $10. Each question is voiced once per persona and speed, then cached; speech-to-text is about $0.008 a minute.
- **Supabase**: Free plan, $0.

### 4. Email
Sign-in codes go out through **Resend** over SMTP from `support@pimpme.app`; mail sent to support@pimpme.app is forwarded to the developer by **Cloudflare Email Routing**. The domain was bought through Cloudflare Registrar, so its DNS is already on Cloudflare. Accounts, sign-ins and keys are the developer's.

1. **Forward support@:** Cloudflare → pimpme.app → Email → Email Routing → Get started. Custom address `support`, action "Send to an email", the developer's inbox. Verify that inbox from the email Cloudflare sends, then "Add records and enable" (MX records and an SPF record on `pimpme.app`).
2. **Resend domain:** resend.com → Domains → Add domain → `pimpme.app`. Add its records with the "Sign in to Cloudflare" button or by hand in Cloudflare → DNS → Records (an MX and an SPF TXT on `send`, a DKIM TXT on `resend._domainkey`), then Verify.
3. **DMARC:** Cloudflare → DNS → Records → Add record: TXT, name `_dmarc`, content `v=DMARC1; p=none;`.
4. **SMTP key:** Resend → API Keys → Create API key, "Sending access", domain `pimpme.app`. Paste it after `RESEND_SMTP_PASS=` in `supabase/.env` (gitignored; create the file if it isn't there). Never paste it into a chat.
5. **Push:** the normal `pnpm supabase config diff` and `pnpm supabase config push` (section 2). The `[remotes.rounds-dev.auth.email.smtp]` block in `config.toml` turns on Resend (`smtp.resend.com`, port 465, user `resend`, the key as password, sender "PimpMe"), and the push sends the 6-digit code templates with it. The same block raises the limit to 30 code emails an hour; the local stack keeps 2 and Mailpit.

Resend's free plan sends 100 emails a day. To check delivery, sign in with an email code on the phone and, in Gmail, open the email → ⋮ → Show original: SPF, DKIM and DMARC should all say PASS.

### 5. Content
```bash
pnpm content:push --preview
```
Sends every approved and in-review script and its questions (never drafts or test fixtures) and turns the preview on. Run it again whenever content changes. `--dry-run` shows the counts without sending anything.

### 6. The app's hosted address (EAS)
From `apps/mobile`, store the project's URL and publishable key (Supabase → Project Settings → API Keys) for store builds:
```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value https://xxxx.supabase.co --visibility plaintext
```
```bash
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_... --visibility plaintext
```
The publishable key is safe in the app; RLS protects the data. Never put the secret key or an AI key here.

### 7. Apple
- Sign in with Apple: the bundle id `com.ben.rounds` has `usesAppleSignIn`; EAS turns the capability on during the build. Nothing else is needed for the native flow.
- The first `eas submit` creates the app in App Store Connect if it doesn't exist (it asks for your Apple ID). In App Store Connect → TestFlight → Internal Testing, add yourself and the reviewer.

### 8. Website (pimpme.app)
The site in `apps/site` is a static export served by **Cloudflare Pages** (free) from the Pages project `pimpme`. Deploys are direct uploads from the developer's PC, one per OK: there is no Git integration, so pushing to GitHub deploys nothing.

1. **Sign wrangler in (once):** `pnpm --filter site exec wrangler login`. A browser opens on Cloudflare; click Allow.
2. **Deploy:** `pnpm site:deploy`. It builds the site (and `pimpme.ankiaddon` from `packages/anki-addon`, pointed at `rounds-dev`) and uploads `apps/site/out`. The project `pimpme` and the address `pimpme.pages.dev` exist since 25 Nov 2026. (Wrangler 4.168 hands new Pages projects to Workers, which failed on this monorepo, so it was made with `wrangler pages project create pimpme --production-branch main --force`; later deploys need no flag.)
4. **Daily pimp:** the site talks to `rounds-dev` with the URL and publishable key in `apps/site/.env.production` (public values; RLS protects the data). For `pnpm site` against the local stack, copy `apps/site/.env.example` to `.env.development.local` with the values from `supabase status`. The page needs the migration `20261127120000_daily_pimp.sql` on the project (`pnpm supabase db push`).
5. **Tester list (M4.3, used again in M4.4):** testers sign in with the email of an existing PimpMe account (the app's Settings → Account → email). Only the developer adds them, in the Supabase dashboard → SQL Editor (lower case):
   ```sql
   insert into public.testers (email) values ('student@school.edu');
   ```
   Remove one with `delete from public.testers where email = '…';`. Clients can't read or change the list. Until a script is approved, only testers can play the daily pimp; after that it is open to everyone, with approved scripts only.
6. **Custom domain (once):** Cloudflare → Workers & Pages → `pimpme` → Custom domains → Set up a custom domain → `pimpme.app` → Continue → Activate domain. Repeat for `www.pimpme.app`. Cloudflare adds a CNAME for each; the MX, SPF, DKIM, DMARC and Email Routing records (section 4) stay as they are. Check with `Resolve-DnsName pimpme.app -Type MX` afterwards.

## Each release
From `apps/mobile`:
```bash
npx eas-cli@latest build --profile production --platform ios
```
About 15–25 minutes in the cloud. The build number goes up by itself.
```bash
npx eas-cli@latest submit --platform ios --latest
```
After Apple processes it (often 5–30 minutes), the build appears in the TestFlight app on the phone.

If migrations or functions changed since the last release, first run `pnpm supabase db push` and `pnpm supabase functions deploy`; if content changed, `pnpm content:push --preview`.

## Try it on the phone
Install from TestFlight, then check: the app opens without an account; a text session; a voice session (allow the microphone); an answer the matcher doesn't know, so Claude grades it; Settings → Account → email code; Sign in with Apple; delete account.

The development build (`docs/PHONE.md`) keeps working against the PC's local stack. Both can be installed at once only if they have different bundle ids; installing one replaces the other.
