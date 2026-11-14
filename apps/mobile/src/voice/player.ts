/**
 * Plays the attending's voice: 16-bit PCM, scheduled piece by piece so sound
 * starts on the first piece (M2.4: streaming raw audio started in ~0.2 s; an
 * mp3 element waited for a buffer). One thing plays at a time.
 */
import { PcmDecoder } from '@rounds/shared';
import { SPEECH_SAMPLE_RATE } from '@rounds/shared/api';
import type { AudioOut } from './types';

export class PcmPlayer {
  private stoppers: (() => void)[] = [];
  private generation = 0;
  private finish: (() => void) | null = null;

  constructor(private readonly out: AudioOut) {}

  /** Stops whatever is playing; its `play` promise resolves at once. */
  stop(): void {
    this.generation++;
    this.stoppers.forEach((stop) => stop());
    this.stoppers = [];
    this.finish?.();
    this.finish = null;
  }

  /**
   * Plays PCM pieces as they arrive. Resolves when the sound has finished (or
   * was stopped). `onStart` fires when the first piece is scheduled.
   */
  async play(pieces: AsyncIterable<Uint8Array> | Uint8Array, onStart?: () => void): Promise<void> {
    this.stop();
    const generation = this.generation;
    await this.out.resume().catch(() => {});
    const decoder = new PcmDecoder();
    let playhead = 0;
    let started = false;
    const iterable: AsyncIterable<Uint8Array> =
      pieces instanceof Uint8Array
        ? (async function* one() {
            yield pieces;
          })()
        : pieces;
    for await (const piece of iterable) {
      if (generation !== this.generation) return;
      const samples = decoder.push(piece);
      if (samples.length === 0) continue;
      const when = Math.max(playhead, this.out.currentTime + 0.02);
      const scheduled = this.out.schedule(samples, SPEECH_SAMPLE_RATE, when);
      this.stoppers.push(scheduled.stop);
      playhead = when + scheduled.duration;
      if (!started) {
        started = true;
        onStart?.();
      }
    }
    if (generation !== this.generation || !started) return;
    const remainingMs = (playhead - this.out.currentTime + this.out.latency) * 1000;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(
        () => {
          if (this.finish === done) this.finish = null;
          resolve();
        },
        Math.max(0, remainingMs),
      );
      const done = () => {
        clearTimeout(timer);
        resolve();
      };
      this.finish = done;
    });
  }
}

/** Reads a fetch Response body piece by piece (whole body if it can't stream). */
export async function* responsePieces(response: Response): AsyncIterable<Uint8Array> {
  const reader = response.body?.getReader();
  if (!reader) {
    yield new Uint8Array(await response.arrayBuffer());
    return;
  }
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    if (value) yield value;
  }
}
