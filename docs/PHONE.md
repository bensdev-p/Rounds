# Rounds on the iPhone (development build)

Voice needs the microphone. Safari blocks the mic on the plain-http home Wi-Fi address, and Expo Go doesn't have the native audio module, so voice runs in a **development build**: the real Rounds app, built once in the cloud (EAS) and installed on a registered iPhone. It loads the app's code from `pnpm start` on the PC, so code changes still show up without rebuilding. Rebuild only when a native package or `app.json` changes.

No Mac or Xcode is needed.

## Once

1. **Voice key.** In `supabase/functions/.env`, set `DEEPGRAM_API_KEY` (Member role). Without it, sessions open in text mode.
2. **Build.** In a terminal on the PC, from `apps/mobile`:
   ```bash
   npx eas-cli@latest login
   ```
   ```bash
   npx eas-cli@latest init
   ```
   (links the project; it adds a project id to `app.json`, which gets committed)
   ```bash
   npx eas-cli@latest device:create
   ```
   (opens a link to open on the iPhone, which registers it)
   ```bash
   npx eas-cli@latest build --profile development --platform ios
   ```
   The first build asks for the Apple ID and makes the certificates. It takes 15–25 minutes in the cloud. When it's done, open the build page link on the iPhone and install.
3. **Developer Mode.** iPhones hide this switch until an app like this is installed, so it comes after the install. Tap the Rounds icon once: iOS says Developer Mode is required. Then Settings → Privacy & Security, scroll to the bottom, Developer Mode → on. The phone restarts and asks you to confirm with your passcode.

## Every day

1. On the PC: `pnpm start` (database, grading and voice server, app).
2. On the iPhone, same Wi-Fi: open **Rounds** (the development build). Pick the PC from the list, or "Enter URL manually" with the address `pnpm start` prints (`http://192.168.x.x:8081`).
3. The first time, allow **Local Network** and **Microphone**.

Spending: each new question is voiced once per persona and speed, then cached. Speech-to-text costs about $0.008 a minute. The cap is $10 for speech.
