/**
 * Our own end-of-answer check (M2.4: it saved ~0.2 s over the vendor's).
 * Fed 20 ms mic frames (level and time); decides when the student has started
 * and then stopped speaking. A pause mid-answer doesn't end the turn, and list
 * questions wait longer, since students pause between items.
 * Wireframe 04 note 3: the answer also ends on a tap (`endNow`).
 */
import type { Question } from '../schemas/question.ts';

/** Silence that ends an answer (developer's call, M2.5): short for one answer, longer for lists. */
export const SILENCE_MS = { single: 800, list: 1_500 } as const;

export interface EndOfTurnConfig {
  /** RMS level (0–1) above which a frame counts as speech. */
  threshold: number;
  /** Speech must last this long (in a row) to count, so a cough or click doesn't start it. */
  minSpeechMs: number;
  /** Silence after speech that ends the answer. */
  silenceMs: number;
}

export const DEFAULT_THRESHOLD = 0.02;
export const MIN_SPEECH_MS = 120;

export function endOfTurnConfig(kind: Question['kind']): EndOfTurnConfig {
  return { threshold: DEFAULT_THRESHOLD, minSpeechMs: MIN_SPEECH_MS, silenceMs: SILENCE_MS[kind] };
}

export type TurnPhase = 'waiting' | 'speaking' | 'ended';

export interface TurnState {
  phase: TurnPhase;
  /** Speech so far in the current run of loud frames, before speech has started. */
  voicedRunMs: number;
  /** When the last loud frame ended (ms), once speaking. The end of speech, for timing. */
  lastVoiceAt: number | null;
  /** 'tap' when the student ended it, 'silence' when the check did. */
  endedBy: 'silence' | 'tap' | null;
}

export const initialTurn: TurnState = {
  phase: 'waiting',
  voicedRunMs: 0,
  lastVoiceAt: null,
  endedBy: null,
};

export interface Frame {
  rms: number;
  /** When the frame ends (ms, any monotonic clock). */
  at: number;
  durationMs: number;
}

export function onFrame(state: TurnState, config: EndOfTurnConfig, frame: Frame): TurnState {
  if (state.phase === 'ended') return state;
  const loud = frame.rms > config.threshold;
  if (state.phase === 'waiting') {
    if (!loud) return state.voicedRunMs === 0 ? state : { ...state, voicedRunMs: 0 };
    const run = state.voicedRunMs + frame.durationMs;
    return run >= config.minSpeechMs
      ? { ...state, phase: 'speaking', voicedRunMs: run, lastVoiceAt: frame.at }
      : { ...state, voicedRunMs: run };
  }
  if (loud) return { ...state, lastVoiceAt: frame.at };
  const quietFor = frame.at - (state.lastVoiceAt ?? frame.at);
  return quietFor >= config.silenceMs ? { ...state, phase: 'ended', endedBy: 'silence' } : state;
}

/** The student tapped the mic: the answer ends now. */
export function endNow(state: TurnState): TurnState {
  return state.phase === 'ended' ? state : { ...state, phase: 'ended', endedBy: 'tap' };
}
