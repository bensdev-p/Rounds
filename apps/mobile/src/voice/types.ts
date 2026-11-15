/**
 * What the voice engine needs from each platform. The web (Chrome on the PC)
 * uses the browser's Web Audio; the iPhone build uses react-native-audio-api,
 * which has the same shape. See platform.ts (web) and platform.native.ts.
 */
import type { PcmFrame } from '@rounds/shared';

/** The parts of a Web Audio AudioContext the player uses. */
export interface AudioOut {
  readonly currentTime: number;
  /** Seconds between scheduling and sound leaving the speaker, if known. */
  readonly latency: number;
  /** Schedules mono samples at `when` (seconds); returns a stopper. */
  schedule(
    samples: Float32Array,
    sampleRate: number,
    when: number,
  ): { duration: number; stop(): void };
  resume(): Promise<void>;
}

export interface MicFrame extends PcmFrame {
  /** When the frame ended (ms, performance clock). */
  at: number;
}

export interface Mic {
  stop(): Promise<void>;
}

export type MicPermission = 'granted' | 'denied' | 'unsupported';

export interface VoicePlatform {
  /** False where voice can't work here (e.g. Safari over http blocks the mic). */
  supported(): boolean;
  /** Asks for the mic and sets up the audio session (iPhone: speaker, play and record). */
  prepare(): Promise<MicPermission>;
  audioOut(): AudioOut;
  startMic(onFrame: (frame: MicFrame) => void): Promise<Mic>;
  /** A fetch whose response body streams (React Native's own fetch doesn't). */
  fetch: typeof fetch;
}
