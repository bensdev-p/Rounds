import { Easing } from 'remotion';
import { MISSED_RUNG, QUESTION_FRAMES_PER_WORD, buildSchedule } from './session.ts';
import { motion } from './theme.ts';

/** Timings from docs/design/VIDEO.md. Both compositions share them. */
export const FPS = 30;

export type SceneId =
  'intro' | 'session' | 'climb' | 'result' | 'list' | 'log' | 'review' | 'promotion' | 'end';

export interface Scene {
  id: SceneId;
  from: number;
  to: number;
  caption: string | null;
  /** How far the camera pushes in on the phone (1 = whole phone). */
  zoom: number;
}

const CUT: readonly [SceneId, seconds: number, caption: string | null, zoom: number][] = [
  ['intro', 5.5, null, 1],
  ['session', 5.5, 'An attending in your pocket.', 1],
  ['climb', 16, 'Climb until you miss.', 1.16],
  ['result', 6, 'See exactly what you missed.', 1],
  ['list', 7, 'Partial credit. Real gaps.', 1.14],
  ['log', 7, 'Log the diagnosis. Never the patient.', 1.18],
  ['review', 6, 'Sort out the mix-ups tonight.', 1.14],
  ['promotion', 8, 'Earn your way to Attending.', 1],
  ['end', 4, null, 1],
];

export const SCENES: readonly Scene[] = CUT.reduce<Scene[]>((scenes, [id, seconds, caption, zoom]) => {
  const from = scenes.at(-1)?.to ?? 0;
  return [...scenes, { id, from, to: from + seconds * FPS, caption, zoom }];
}, []);

export const DURATION = SCENES.at(-1)?.to ?? 0;

export const scene = (id: SceneId): Scene => {
  const found = SCENES.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown scene: ${id}`);
  return found;
};

export const sceneAt = (frame: number): Scene =>
  SCENES.find((s) => frame >= s.from && frame < s.to) ?? scene('end');

export const TAGLINE = 'Get asked here first.';
export const END_CARD_LINE = 'Practice the questions before rounds ask them.';

export const msToFrames = (ms: number): number => (ms / 1000) * FPS;

/** Fades and short slides stay at or under 300 ms. */
export const FADE = msToFrames(300);
/** Hero moment 1: the rung pass, 280 ms with a slight overshoot. */
export const RUNG_PASS_FRAMES = msToFrames(motion.rungPassMs);
/** Hero moment 2: the promotion rise, 400 ms. */
export const PROMOTION_RISE_FRAMES = msToFrames(400);
/** Camera push-ins between scenes are slow and eased. */
export const CAMERA_FRAMES = msToFrames(900);

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
export const easeInOut = Easing.inOut(Easing.cubic);

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

/** The camera eases from the previous scene's zoom at the start of each scene. */
export const cameraZoom = (frame: number): number => {
  const current = sceneAt(frame);
  const previous = SCENES[SCENES.indexOf(current) - 1] ?? current;
  const t = easeInOut(ramp(frame, current.from, CAMERA_FRAMES));
  return previous.zoom + (current.zoom - previous.zoom) * t;
};

// ------------------------------------------------------------ the session

/** Scene 2 opens on Home; "Pimp me" is tapped and the session starts here. */
export const HOME_FRAMES = 45;
export const HOME_TAP = scene('session').from + HOME_FRAMES - 12;
export const SESSION_START = scene('session').from + HOME_FRAMES;

export const BEATS = buildSchedule(SESSION_START);

/** Global frames of each rung pass, then the miss. */
export const RUNG_PASSES: readonly number[] = BEATS.slice(0, MISSED_RUNG - 1).map((b) => b.verdict);
export const MISS_FRAME = BEATS[MISSED_RUNG - 1]?.verdict ?? DURATION;

/** Poster frame: mid-climb, rungs 1–2 passed and rung 3 current (session.png). */
export const POSTER_FRAME = (BEATS[2]?.answerEnd ?? 0) + 15;

/** The promotion scene cuts from the result screen to the promotion screen here. */
export const PROMOTION_CUT = scene('promotion').from + 100;

export const FRAMES_PER_WORD = QUESTION_FRAMES_PER_WORD;

export const wordsShown = (frame: number, start: number, perWord: number = FRAMES_PER_WORD): number =>
  frame < start ? 0 : Math.floor((frame - start) / perWord) + 1;
