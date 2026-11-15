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
Sends the auth settings from `supabase/config.toml`: "Confirm email" on, anonymous sign-ins, manual linking (for Apple), the 6-digit code email templates, and Sign in with Apple with `com.ben.rounds` as the client id. The `[remotes.rounds-dev]` block at the end of `config.toml` keeps the hosted project's own pooler and storage settings, a 60 s gap between code emails, and no localhost redirect. Read the diff before saying yes.
```bash
pnpm supabase secrets set ANTHROPIC_API_KEY=... DEEPGRAM_API_KEY=... GRADER_MODEL=claude-opus-5-5
```
Type the keys yourself; never paste them into a chat. `DEEPGRAM_API_KEY` needs the Member role.
```bash
pnpm supabase functions deploy
```
Deploys `grade-answer`, `delete-account`, `speak` and `speech-token`. Supabase provides `SUPABASE_URL` and the keys they read.

### 3. Spending caps
- **Anthropic** (grading): in the Anthropic Console, set a monthly spend limit on the workspace that owns the key.
- **Deepgram** (speech): $10. Each question is voiced once per persona and speed, then cached; speech-to-text is about $0.008 a minute.
- **Supabase**: Free plan, $0.

### 4. Email (not set up yet)
On the Free plan, Supabase's built-in email can't use custom templates, and its default sign-in email has a link, not the 6-digit code the app asks for. So `config push` is refused while `config.toml` declares the code templates. **Email sign-in doesn't work on `rounds-dev` yet** (developer's call, 14 Nov 2026); use the app without an account or with Sign in with Apple.

Until then, push the auth settings from a copy of `config.toml` without the `[auth.email.template.*]` sections:
```bash
pnpm supabase config push --workdir <folder holding supabase/config.toml without the template sections> --remote=qugvfidjzmtkrnfdokhf
```
To turn email on: set up SMTP (Supabase → Authentication → Emails → SMTP Settings; for example Gmail with an app password, or Resend with a domain you own), then run the normal `pnpm supabase config push`.

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
