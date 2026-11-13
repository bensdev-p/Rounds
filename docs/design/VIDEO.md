# Rounds vision video spec

A 65-second animated video that shows the design direction and the vision. It's built in code with Remotion (`apps/video`) so it uses the real design tokens, and later the real components.

The story: a student freezes on a question at morning rounds, then meets the same question in the app, gets three of five, and knows exactly what to fix. Timings live in `apps/video/src/timeline.ts` and the session content in `apps/video/src/session.ts`; this table describes them.

## Rules
- **Recreate screens as React components** that match `png/mockups/`. Never embed the PNGs.
- **Use only `tokens.json`** colours, type and radii. Fonts come from `docs/design/fonts/`.
- **Motion follows DESIGN.md.** The two hero moments are the **rung pass** (280 ms, `cubic-bezier(0.2, 0.9, 0.3, 1.2)`) and the **promotion rise** (400 ms). Everything else inside the phone is a simple fade or a short slide (≤ 300 ms). No confetti, glows, particles, 3D or camera shake.
- **Camera:** between scenes the camera may push in on the phone, slowly (900 ms, eased), by at most 1.2×. It pushes in from the phone's top edge, so the status bar stays put. No pans, no rotation.
- **Touch cue:** when the student taps, a soft `text`-coloured dot marks the spot for a third of a second. Used twice: "Pimp me" and "Save".
- **Phone frame:** 390×844 logical screen, 44 px corner radius, a hairline `line` outline, no device chrome other than the status bar.
- **Background** behind the phone is `bg` (#0E1A2E). The phone itself uses the dark theme.
- **On-screen captions** (outside the phone) are Archivo 600, sentence case, at most 7 words, one at a time.
- **Never use the word "pimp"** in captions, the cold open or the end card. It may appear inside the app UI (the "Pimp me" button).
- **Medical content traces to the mockups.** Every question and answer in the session comes from the acute pancreatitis script on `script.png`, or from `session.png`, `list.png` and `result.png`.
- **Audio** is optional and off by default. If added: one soft tick on each rung pass, nothing else.

## Compositions
| ID | Size | Notes |
|---|---|---|
| `VisionVertical` | 1080×1920, 30 fps | Phone fills the frame; captions above it |
| `VisionWide` | 1920×1080, 30 fps | Phone on the right, captions large on the left |

Both share the same scene components and timings.

## Scenes
| # | Seconds | Scene | Caption | Motion |
|---|---|---|---|---|
| 1 | 0–5.5 | Cold open, no phone. One amber pager blink. "Morning rounds, 6:42 am", then the attending's question types on: "Name five causes of an anion gap acidosis." An amber caret blinks; "Everyone is waiting." Then the "Rounds" wordmark (Archivo Narrow 700) with "Get asked here first." | — | Blink: 2 frames on, then fade. Typewriter at about 8 words/s. |
| 2 | 5.5–11 | Home. "Pimp me" is tapped and the live session opens: rung 1, question types on, waveform goes live, transcript appears | "An attending in your pocket." | Touch cue. Waveform bars oscillate while the mic is live. |
| 3 | 11–27 | Same screen. The ladder climbs 1 → 5, faster at the bottom, then misses on rung 5 (management), which turns coral | "Climb until you miss." | **Rung pass** each time: fill to pass green, next rung pops amber. Camera pushes in. |
| 4 | 27–33 | Result with the miss: 4 rungs climbed, and the card that quotes what the student said next to what the script says | "See exactly what you missed." | The score counts 0 → 4. |
| 5 | 33–40 | List-question feedback, the cold open's question. 3 of 5. Pills arrive one by one; the two misses appear as dashed outlines | "Partial credit. Real gaps." | Pills slide in 6 frames apart. The score counts 0 → 3. |
| 6 | 40–47 | Log screen. "Mr. Alvarez CHF" is typed, the field turns coral and the warning appears; the name is deleted and it saves as "Heart failure exacerbation" | "Log the diagnosis. Never the patient." | Field border colour change, then the warning collapses. Touch cue on Save. |
| 7 | 47–53 | Evening review, listing the two misses from scenes 3 and 5. Nephritic and nephrotic columns slide together from the left and right | "Sort out the mix-ups tonight." | Columns slide 40 px and fade in. |
| 8 | 53–61 | Clean-run result: the third rounds segment fills and the rank bar completes. Cut to the Promotion screen; the Resident step rises | "Earn your way to Attending." | Segments fill instantly. **Promotion rise.** |
| 9 | 61–65 | End card: wordmark plus the line "Practice the questions before rounds ask them." | — | Hold. Fade out over the last 10 frames. |

## Output
- `apps/video/out/rounds-vision-vertical.mp4`
- `apps/video/out/rounds-vision-wide.mp4`
- One poster frame per composition, taken mid-climb in scene 3 with rungs 1–2 passed and rung 3 current (PNG).

## Later
When the app's real components exist in `packages/ui`, swap the recreated screens for them, so the video always matches what's built.
