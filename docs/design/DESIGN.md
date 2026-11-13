# Rounds design language

Visual guidance for building the app. If a screen isn't covered here, follow the closest mockup and these rules rather than inventing a new pattern.

## What's in this folder

| Path | What it is |
|---|---|
| `png/wireframes/` | 18 low-fidelity screens with numbered notes. **Use these for structure and behaviour.** |
| `png/mockups/` | 14 high-fidelity screens in dark mode, 7 in light mode. **Use these for look and feel.** |
| `wireframes/index.html` | Source for the wireframes (open in a browser to see all at once) |
| `mockups/index.html`, `mockups/light.html`, `mockups/rounds.css` | Source for the mockups. The CSS is a readable reference for exact values. |
| `VIDEO.md` | Spec for the animated vision video (Remotion, `apps/video`) |
| `apps/video/src/screens/` (outside this folder) | Seven screens already recreated in React from these tokens for the video: Home, live session, list feedback, result (miss and clean run), Log, Review, Promotion. They are web React, not React Native, so use them as a worked reference for values and structure, not as code to import. |
| `tokens.json` | Colours, type, spacing, radii, motion. Import into `packages/shared/theme`. |
| `fonts/` | Archivo and Archivo Narrow (also on npm as `@expo-google-fonts/archivo` and `@expo-google-fonts/archivo-narrow`) |

Screen list: onboarding, Pimp (home), script picker, live session (voice and text), list-question feedback, session result (miss and clean run), promotion, Log, Review, illness script, script collection, Profile, Settings and Anki. Later stage: team board, join a team, challenge result.

## The idea

The look comes from **hospital scrubs and the pager**:
- **Navy and ceil blue** (the classic scrub colours) are the base.
- **Pager amber** is the one loud colour, used for "act now": the Pimp me button and the current rung.

It should feel calm and confident: dark-first, big condensed numbers, readable at arm's length on a hospital corridor, one obvious action per screen.

**The signature element is the ladder.** Six square rungs stacked bottom to top, with big condensed numerals:
- passed rungs are green,
- the current rung is solid amber,
- a missed rung is coral,
- rungs not reached yet are dim.

The ladder is the most distinctive thing in the app, so everything around it stays quiet.

## The session, start to finish

The vision video (`VIDEO.md`) shows one session end to end. Build the app's flow to match it:

1. **Home.** One tap on "Pimp me" starts the session with the chosen persona.
2. **Live session.** The ladder sits above the question. While the attending is asking, the mic is idle: the waveform is a flat row of dots. It goes live when the question ends.
3. **Each pass.** The rung fills green and the next rung pops amber. The question and transcript are replaced by the next ones; nothing else on the screen moves.
4. **The miss.** The current rung turns coral, its label turns coral, the waveform stops and the clock stops. No sound, no shake, no modal.
5. **Result.** About a second later the result screen replaces the session. It shows the rung reached and the miss card (below).
6. **That evening.** The miss appears in Review under "Missed today", with the same wording as the miss card's label.

Layout rules that keep this calm:
- The transcript panel always reserves three lines, so it never changes height while the student is speaking.
- The question is replaced in place. It never pushes the ladder or the panel.

## Progression (the gamified part)

The rule of thumb: **reward the work, never nag about the absence of it.** Everything below runs on the rungs students already climb. There's no separate points system to learn.

| Mechanic | How it works | Where it shows |
|---|---|---|
| **Today's rounds** | Daily goal of 3 sessions (adjustable 1 to 5). Three short segments fill in amber. | Home hero panel, result screen |
| **Shifts** | A day with rounds finished counts as a shift. Consecutive shifts make the streak. One **post-call day** per week is applied automatically and doesn't break it. | Home (one line), Profile grid (ceil blue, post-call days outlined) |
| **Rank** | Six clinical titles earned by total rungs climbed: MS3 (0), Sub-I (150), Intern (500), Resident (1,200), Chief (2,500), Attending (5,000). Never goes down. Drawn as six rising steps. | Rank chip on Home, Profile card, Promotion screen |
| **Mastery** | A script is mastered when rung 6 is reached on two different days. After 30 days it becomes **Re-check due** until rung 6 is reached again. | Script collection tiles, rotation bars on Profile, result badge |
| **Badges** | Only three exist: Clean run (no partial answers), New best, Script mastered. At most two per result. | Result screen |
| **Persona lines** | One short, dry line from the attending at the end of a session or on promotion. Teases, never gushes. | Result, Promotion |

Restraint rules:
- **One celebration screen:** Promotion, shown once per rank (5 times ever). Everything else is celebrated in place: the ladder, a badge, a number turning green.
- **No confetti, no mascots, no coins, no XP counters,** no sounds except haptics, no public leaderboards. Teams (below) are opt-in and small.
- **Progress shows only between sessions** (Home, result, Profile). Mid-session screens show the ladder and nothing else.
- **No guilt.** Never "You lost your streak!" When a streak resets, the count quietly starts again. No push notifications about streaks, only an optional reminder the student sets themselves.
- **Visual coding:** amber = progress you're making (rounds segments, rank steps, mastered outline). Green = correct and passed. Ceil = history (the shifts grid). Coral = weakest or missed.

## Teams (later stage, opt-in)

A small, invite-only group, usually classmates on the same rotation, who see each other's weekly effort. It's designed so it motivates the people in the middle of the pack instead of only the person at the top.

**What it is:**
- **Size and access:** up to 12 people. Join with an invite code or link. Off by default.
- **Where it lives:** under Profile (an entry row below mastery). There's no fifth tab, and nothing about teams appears on Home or mid-session.
- **Shared weekly goal first:** "Together: 1,240 of 1,500 rungs." The goal is 300 rungs per member, rounded. Everyone's rungs count toward it, including members who hide their own row.
- **Weekly list:** sorted by rungs climbed this week. Each row shows a 7-dot strip for the days that member finished rounds (ceil blue). Resets every Monday.
- **Challenges:** send one script to a teammate. They climb the same ladder (any persona) and see your best rung. The result adds one comparison line: "you passed", "tied" or "Priya leads". Never "you lost".

**Privacy (spelled out on the join screen):**
- **Shared:** first name, rank title, rungs this week, days rounds were finished. The last two can each be switched off.
- **Never shared:** misses, weak spots, mix-ups, which scripts someone studied, logged patients.

**Restraint:**
- No colour or label for last place, no "behind" wording, no crowns or podiums.
- Your own row is tinted `surface2` and its avatar uses signal. Other avatars are initials on `surface2`, never photos.
- A notification is sent for a challenge only if the receiver turned challenge notifications on. There's no "your friend passed you" alert.
- Teams never affect rank, shifts or mastery. Those stay personal.

Screens: `png/mockups/team.png`, `team-light.png`, `team-join.png`, `challenge.png`. Wireframes 16–18.

## Colour

Use tokens only, never raw hex in components.

| Token | Dark | Light | Use |
|---|---|---|---|
| `bg` | #0E1A2E | #F2F5F9 | Screen background |
| `surface` / `surface2` | #16243C / #1E2F4C | #FFFFFF / #E7ECF3 | Grouped lists, panels / chips, quiet buttons |
| `line` | #2A3D5E | #D3DBE6 | Dividers inside lists, field borders |
| `text` / `text2` / `text3` | #EEF2F8 / #9BAAC2 / #6B7D99 | | Primary / secondary / disabled-ish |
| `ceil` | #8FB3E0 | #2F5E99 | Links, info, script section labels, sync |
| `signal` | #FFB547 | #F5A623 | Primary button, current rung, active tab icon. **Nothing else.** |
| `pass` / `miss` | #5CCB8F / #F2766B | #1F8F55 / #CC4437 | Correct and passed / missed. Never decorative. |

Rules:
- One amber element per screen, at most two (for example the current rung plus the primary button).
- Text on amber is always `onSignal` (navy), never white.
- Green and coral carry meaning only. A coral bar means "weakest", a coral chip means "you confuse this one."
- Dark mode is the default. Light mode uses the same layouts and only swaps tokens.

## Type

There's one family in two widths:
- **Archivo Narrow Bold** for the question, screen titles, numbers and rung numerals.
- **Archivo** for everything else.

| Style | Spec | Where |
|---|---|---|
| `question` | Narrow 700, 31/35 | The pimp question. Always the biggest text in a session. |
| `h1` | Narrow 700, 34/36 | Screen titles |
| `h2` | Narrow 700, 22/25 | Panel titles, comparison headers |
| `h3` | Archivo 600, 17/22 | Section titles |
| `body` | Archivo 400, 16/22 | Default |
| `meta` / `small` | Archivo 400, 14 / 13 | Supporting text in `text2` |
| `scoreHero` | Narrow 700, 88 | Rungs climbed on the result screen |

Rules:
- Numbers use tabular figures.
- Sentence case everywhere. No all-caps labels, no letter-spaced eyebrows above headings.
- Keep supporting lines short. If a line wraps to three lines, rewrite it.

## Layout

- 20 pt horizontal screen margin. Section gap 26 pt, inside-list padding 14×16.
- Grouped lists are a single `surface` block with hairline dividers, not a stack of separate cards.
- Radii follow hierarchy: hero panel 28 → list 18 → field/row 14 → rung 12 → buttons and chips fully round. Don't use one radius for everything.
- No drop shadows. Depth comes from `bg` → `surface` → `surface2`.
- Primary action sits in the thumb zone (bottom third) on session screens, and in the hero panel on Home.
- Tab bar: Pimp, Log, Review, Profile. Session screens hide the tab bar.
- Minimum touch target 44 pt.

## Components (see mockups for exact styling)

- **Button:** primary (amber), quiet (`surface2`), line (outlined). Height 52; 60 for the Home hero button. Icon left, label in plain verbs ("Go again", "Drill this pair"). No arrows appended to labels.
- **Segmented control:** for persona selection.
- **List row:** title, optional `small` subtitle, trailing chip, chevron or value.
- **Rung:** 44×44 square, numeral centred, label to the right.
- **Answer pill:** `got` (green tint, check icon) or `missed` (dashed coral outline, minus icon). Missed items read as gaps, not errors.
- **Miss card:** a `surface` panel (radius 18, padding 16) on the result screen. A `small` label ("Missed on management"), one 15 pt sentence that quotes the student's words in `miss` and then states what the script says in `text`, and a "Review the script" link in `ceil`. One card per session, never on a clean run. It is planned, not built: see PRODUCT.md → Planned: the miss card.
- **Rank progress line** (result screen): "+4 rungs, 6 to go". On the session that earns a rank it reads "+6 rungs. Resident", the bar is full, and the Promotion screen follows.
- **Field:** 52 high. Error state = coral border plus a warning block underneath that says exactly what to remove.
- **Comparison:** two columns, same keys on both sides (mix-up drill).
- **Bars:** 8 pt tall, rounded. The weakest bar is coral, the rest amber.
- **Rounds segments:** three 6 pt bars with 6 pt gaps.
- **Rank track:** six steps of rising height. Past steps amber, current step amber with a 2 pt `text` outline, future steps `surface2`.
- **Mini ladder:** 6 stacked 3 pt bars, 22 pt wide, best rung filled green. Used on collection tiles.
- **Badge:** 28 pt tall, 8 radius, tinted background with icon and label (pass or signal tint only).

Icons: 2 pt stroke, rounded caps, 24 pt grid. Lucide (`lucide-react-native`) matches this style.

## Motion

There are two memorable moments, and nothing else:
1. **Passing a rung:** the rung fills from dim to green, and the next rung pops to amber with a slight overshoot (280 ms), plus a light haptic.
2. **Promotion:** the new rank step rises into place (400 ms), plus a success haptic.

Result screens can count the score up once (under 600 ms). Rounds segments fill without animation.

The video also uses slow camera push-ins and a touch dot where the student taps. Those are for the video only; don't add them to the app.

Everything else is plain and quick: sheets slide at 240 ms, no entrance animations on lists, no looping decoration. The voice waveform is the only continuous animation, and only while the mic is live. Respect Reduce Motion: swap the animations for instant state changes.

## Voice and copy

- The app speaks plainly. The **attending persona** has the personality, and it shows up only in quoted lines during sessions.
- Buttons say what happens: "Pimp me", "Go again", "Save", "Drill this pair". The same action keeps the same name everywhere.
- Errors say what's wrong and how to fix it: "This looks like a patient's name. Remove 'Mr. Alvarez' and keep only the diagnosis."
- Empty states invite an action: "Log a patient to practise on them tonight."
- No guilt: missed days are never called out. No confetti, no mascots, no sparkle icons.
- Outside the app (video, store listing, site), the line is "Get asked here first." The longer form is "Practice the questions before rounds ask them." Neither uses the word "pimp".
- Hospital vocabulary is the theme: rounds, shifts, post-call, ranks. Use it plainly; don't pun on top of it.

## Avoid

- Gradients, glassmorphism, glow effects, neon outlines.
- Purple or blue-violet "AI" accents. Sparkle/✨ icons for AI features (grading is just grading).
- Stacks of identical floating cards with soft shadows.
- Emoji in UI copy.
- Percent scores. The rung reached is the score.
