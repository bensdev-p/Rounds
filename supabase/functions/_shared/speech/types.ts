/**
 * The `stt` and `tts` provider interfaces (CLAUDE.md: keep AI calls behind a
 * provider interface so vendors can be swapped). Keys stay in the functions:
 * the app gets a short-lived streaming token for speech-to-text and audio
 * bytes for the voice.
 */

/** What the app needs to open a streaming speech-to-text connection itself. */
export interface StreamingToken {
  /** The app has a matching client for each vendor (apps/mobile/src/voice/stt.ts). */
  vendor: 'deepgram' | 'fake';
  token: string;
  /** Seconds the token can be used to open a connection. */
  expires_in: number;
  /** Speech-to-text model. */
  model: string;
}

export interface SttProvider {
  readonly name: string;
  issueStreamingToken(): Promise<StreamingToken>;
}

/** The attending's voices. Rank never changes the voice (M2.4). */
export type PersonaVoice = 'teacher' | 'surgeon' | 'internist';

/** Audio every provider returns: raw 16-bit little-endian mono PCM at this rate. */
export const PCM_SAMPLE_RATE = 24_000;
export const PCM_FORMAT = `pcm_s16le;rate=${PCM_SAMPLE_RATE};channels=1`;

export interface SynthesisRequest {
  text: string;
  persona: PersonaVoice;
  /** 0.7–1.5, pitch kept. */
  speed: number;
  signal?: AbortSignal;
}

export interface TtsProvider {
  readonly name: string;
  /** The vendor's voice id for a persona, part of the cache key. */
  voiceFor(persona: PersonaVoice): string;
  /** Streams PCM (see PCM_FORMAT) as the vendor makes it. */
  synthesize(request: SynthesisRequest): Promise<ReadableStream<Uint8Array>>;
}

export class SpeechVendorError extends Error {
  override name = 'SpeechVendorError';
}
