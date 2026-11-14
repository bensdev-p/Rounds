/**
 * Raw audio plumbing for the voice session, kept pure so it's tested:
 * the mic's float samples → 16 kHz 16-bit PCM frames for speech-to-text, and
 * the attending's 16-bit PCM bytes → float samples for the player.
 */

/** What speech-to-text is sent: 16-bit little-endian mono at this rate. */
export const MIC_SAMPLE_RATE = 16_000;
/** 20 ms at 16 kHz. */
export const MIC_FRAME_SAMPLES = 320;

export interface PcmFrame {
  /** Int16 little-endian samples at MIC_SAMPLE_RATE. */
  pcm: ArrayBuffer;
  /** Loudness, 0–1 (root mean square). */
  rms: number;
  durationMs: number;
}

/**
 * Turns float mic samples at any rate into 20 ms frames at 16 kHz, averaging
 * the samples between output points (a cheap low-pass). Keeps its state
 * between calls, so chunks can be any length.
 */
export class MicResampler {
  private acc = 0;
  private count = 0;
  private phase = 0;
  private frame = new Int16Array(MIC_FRAME_SAMPLES);
  private filled = 0;
  private sumSquares = 0;

  constructor(private readonly inputRate: number) {}

  push(samples: Float32Array): PcmFrame[] {
    const out: PcmFrame[] = [];
    for (let i = 0; i < samples.length; i++) {
      this.acc += samples[i] ?? 0;
      this.count++;
      this.phase += MIC_SAMPLE_RATE;
      if (this.phase < this.inputRate) continue;
      this.phase -= this.inputRate;
      const value = this.acc / this.count;
      this.acc = 0;
      this.count = 0;
      this.sumSquares += value * value;
      this.frame[this.filled++] = Math.max(-32768, Math.min(32767, Math.round(value * 32768)));
      if (this.filled === MIC_FRAME_SAMPLES) {
        out.push({
          pcm: this.frame.buffer,
          rms: Math.sqrt(this.sumSquares / MIC_FRAME_SAMPLES),
          durationMs: (MIC_FRAME_SAMPLES / MIC_SAMPLE_RATE) * 1000,
        });
        this.frame = new Int16Array(MIC_FRAME_SAMPLES);
        this.filled = 0;
        this.sumSquares = 0;
      }
    }
    return out;
  }
}

/**
 * Decodes 16-bit little-endian PCM bytes that arrive in pieces of any length.
 * An odd byte at the end of a piece is held for the next one.
 */
export class PcmDecoder {
  private carry: number | null = null;

  push(bytes: Uint8Array): Float32Array {
    let data = bytes;
    if (this.carry !== null) {
      const joined = new Uint8Array(bytes.length + 1);
      joined[0] = this.carry;
      joined.set(bytes, 1);
      data = joined;
      this.carry = null;
    }
    if (data.length % 2 === 1) {
      this.carry = data[data.length - 1] ?? 0;
      data = data.subarray(0, data.length - 1);
    }
    const view = new DataView(data.buffer, data.byteOffset, data.length);
    const samples = new Float32Array(data.length / 2);
    for (let i = 0; i < samples.length; i++) samples[i] = view.getInt16(i * 2, true) / 32768;
    return samples;
  }
}

/** Joins byte pieces into one array. */
export function concatBytes(parts: readonly Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const all = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    all.set(part, offset);
    offset += part.length;
  }
  return all;
}
