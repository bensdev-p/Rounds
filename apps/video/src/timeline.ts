import { Easing } from 'remotion';
import { motion } from './theme.ts';

/** Timings from docs/design/VIDEO.md. Both compositions share them. */
export const FPS = 30;
export const DURATION = 1650;

export type SceneId =
  'intro' | 'session' | 'climb' | 'list' | 'log' | 'review' | 'promotion' | 'end';

export interface Scene {
  id: SceneId;
  from: number;
  to: number;
  caption: string | null;
}

export const SCENES: readonly Scene[] = [
  { id: 'intro', from: 0, to: 120, caption: null },
  { id: 'session', from: 120, to: 360, caption: 'An attending in your pocket.' },
  { id: 'climb', from: 360, to: 660, caption: 'Climb until you miss.' },
  { id: 'list', from: 660, to: 900, caption: 'Partial credit. Real gaps.' },
  { id: 'log', from: 900, to: 1110, caption: 'Diagnosis only. Never patient details.' },
  { id: 'review', from: 1110, to: 1320, caption: 'Sort out the mix-ups tonight.' },
  { id: 'promotion', from: 1320, to: 1560, caption: 'Earn your way to Attending.' },
  { id: 'end', from: 1560, to: 1650, caption: null },
];

export const scene = (id: SceneId): Scene => {
  const found = SCENES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown scene: ${id}`);
  return found;
};

export const sceneAt = (frame: number): Scene =>
  SCENES.find((s) => frame >= s.from && frame < s.to) ?? scene('end');

export const END_CARD_LINE = 'Practice the questions before rounds ask them.';

export const msToFrames = (ms: number): number => (ms / 1000) * FPS;

/** "Everything else is a simple fade or a short slide (≤ 300 ms)". */
export const FADE = msToFrames(300);
/** Hero moment 1: the rung pass, 280 ms with a slight overshoot. */
export const RUNG_PASS_FRAMES = msToFrames(motion.rungPassMs);
/** Hero moment 2: the promotion rise, 400 ms (VIDEO.md → Rules). */
export const PROMOTION_RISE_FRAMES = msToFrames(400);

const bezierArgs = (css: string): [number, number, number, number] => {
  const n = (css.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const [a, b, c, d] = n;
  if (n.length !== 4 || a === undefined || b === undefined || c === undefined || d === undefined) {
    throw new Error(`Not a cubic-bezier: ${css}`);
  }
  return [a, b, c, d];
};

export const rungPassEasing = Easing.bezier(...bezierArgs(motion.rungPassEasing));
export const easeOut = Easing.out(Easing.cubic);

export const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/** Linear 0 → 1 starting at `start`, lasting `duration` frames. */
export const ramp = (frame: number, start: number, duration: number = FADE): number =>
  clamp01((frame - start) / duration);

/**
 * The rung pass at frame `at`.
 * `fill` (0–1) drives the passed rung turning green.
 * `pop` drives the next rung turning amber; it overshoots 1 slightly.
 */
export const rungPass = (frame: number, at: number): { fill: number; pop: number } => {
  const eased = rungPassEasing(ramp(frame, at, RUNG_PASS_FRAMES));
  return { fill: clamp01(eased), pop: eased };
};

/** Scene 3: the ladder climbs 1 → 2 → 3. Global frames of the two passes. */
export const RUNG_PASSES: readonly [number, number] = [
  scene('climb').from + 45,
  scene('climb').from + 120,
];

/** Scene 7 cuts from the result screen to the promotion screen here. */
export const PROMOTION_CUT = scene('promotion').from + 100;

/** Poster frame: scene 3, mid-climb, with rungs 1–2 passed and rung 3 current. */
export const POSTER_FRAME = scene('climb').from + 270;

/** Typewriter at about 8 words a second. */
export const FRAMES_PER_WORD = FPS / 8;

export const wordsShown = (frame: number, start: number, perWord: number = FRAMES_PER_WORD): number =>
  frame < start ? 0 : Math.floor((frame - start) / perWord) + 1;
