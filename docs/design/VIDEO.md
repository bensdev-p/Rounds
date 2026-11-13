# Rounds vision video spec

A ~55-second animated video that shows the design direction and the vision. It's built in code with Remotion (`apps/video`) so it uses the real design tokens, and later the real components.

## Rules
- **Recreate screens as React components** that match `png/mockups/`. Never embed the PNGs.
- **Use only `tokens.json`** colours, type and radii. Fonts come from `docs/design/fonts/`.
- **Motion follows DESIGN.md.** The two hero moments are the **rung pass** (280 ms, `cubic-bezier(0.2, 0.9, 0.3, 1.2)`) and the **promotion rise** (400 ms). Everything else is a simple fade or a short slide (≤ 300 ms). No confetti, glows, particles, 3D or camera shake.
- **Phone frame:** 390×844 logical screen, 44 px corner radius, no device chrome other than the status bar. Scale the frame up to fill the composition.
- **Background** behind the phone is `bg` (#0E1A2E). The phone itself uses the dark theme.
- **On-screen captions** (outside the phone) are Archivo 600, sentence case, at most 7 words, one at a time.
- **Never use the word "pimp"** in captions or the end card. It may appear inside the app UI (the "Pimp me" button).
- **Audio** is optional and off by default. If added: one soft tick on each rung pass, nothing else.

## Compositions
| ID | Size | Notes |
|---|---|---|
| `VisionVertical` | 1080×1920, 30 fps | Phone fills the frame; captions above it |
| `VisionWide` | 1920×1080, 30 fps | Phone on the right, captions large on the left |

Both share the same scene components and timings.

## Scenes (at 30 fps)
| # | Frames | Seconds | Scene | Caption | Motion |
|---|---|---|---|---|---|
| 1 | 0–120 | 0–4 | Empty navy. One amber pager blink (a small rounded rectangle), then the "Rounds" wordmark in Archivo Narrow 700 | — | Blink: 2 frames on, then fade. Wordmark fades up. |
| 2 | 120–360 | 4–12 | Live session screen. The question types on word by word; waveform active; transcript appears | "An attending in your pocket." | Typewriter at about 8 words/s. Waveform bars oscillate. |
| 3 | 360–660 | 12–22 | Same screen. The ladder climbs 1 → 2 → 3, one rung about every 3 s | "Climb until you miss." | **Rung pass** each time: fill to pass green, next rung pops amber. |
| 4 | 660–900 | 22–30 | List-question feedback. 3 of 5. Pills arrive one by one; the two misses appear as dashed outlines | "Partial credit. Real gaps." | Pills slide in 6 frames apart. The score counts 0 → 3. |
| 5 | 900–1110 | 30–37 | Log screen. "Mr. Alvarez CHF" is typed, the field turns coral and the warning appears; the name is deleted and it saves as "Heart failure exacerbation" | "Diagnosis only. Never patient details." | Field border colour change, then the warning collapses. |
| 6 | 1110–1320 | 37–44 | Evening review. Nephritic and nephrotic columns slide together from the left and right | "Sort out the mix-ups tonight." | Columns slide 40 px and fade in. |
| 7 | 1320–1560 | 44–52 | Result: rounds segments fill 2 → 3. Cut to the Promotion screen; the Resident step rises | "Earn your way to Attending." | Segments fill instantly, one per 10 frames. **Promotion rise.** |
| 8 | 1560–1650 | 52–55 | End card: wordmark plus the line "Practice the questions before rounds ask them." | — | Hold. Fade out over the last 10 frames. |

## Output
- `apps/video/out/rounds-vision-vertical.mp4`
- `apps/video/out/rounds-vision-wide.mp4`
- One poster frame per composition, taken from scene 3 mid-climb (PNG).

## Later
When the app's real components exist in `packages/ui`, swap the recreated screens for them, so the video always matches what's built.
