import { describe, expect, it } from 'vitest';
import { concatBytes, MIC_FRAME_SAMPLES, MicResampler, PcmDecoder, resample } from './pcm.ts';

describe('MicResampler', () => {
  it('makes 20 ms frames at 16 kHz from 48 kHz input, across chunk boundaries', () => {
    const resampler = new MicResampler(48_000);
    // 100 ms of 48 kHz audio in uneven chunks → 1,600 samples → 5 frames.
    const chunk = (n: number) => new Float32Array(n).fill(0.5);
    const frames = [...resampler.push(chunk(1_000)), ...resampler.push(chunk(3_800))];
    expect(frames).toHaveLength(5);
    expect(frames[0]!.durationMs).toBe(20);
    const samples = new Int16Array(frames[0]!.pcm);
    expect(samples).toHaveLength(MIC_FRAME_SAMPLES);
    expect(samples[10]).toBe(16_384);
    expect(frames[0]!.rms).toBeCloseTo(0.5, 3);
  });

  it('reports silence as a low level', () => {
    const [frame] = new MicResampler(16_000).push(new Float32Array(MIC_FRAME_SAMPLES));
    expect(frame!.rms).toBe(0);
  });

  it('clips loud input instead of wrapping', () => {
    const [frame] = new MicResampler(16_000).push(new Float32Array(MIC_FRAME_SAMPLES).fill(2));
    expect(new Int16Array(frame!.pcm)[0]).toBe(32_767);
  });
});

describe('PcmDecoder', () => {
  it('decodes little-endian 16-bit samples, holding an odd byte for the next piece', () => {
    const bytes = new Uint8Array(new Int16Array([16_384, -16_384, 0]).buffer);
    const decoder = new PcmDecoder();
    const first = decoder.push(bytes.subarray(0, 3));
    const second = decoder.push(bytes.subarray(3));
    expect(Array.from(first)).toEqual([0.5]);
    expect(Array.from(second)).toEqual([-0.5, 0]);
  });
});

describe('resample', () => {
  it('doubles the samples from 24 kHz to 48 kHz, keeping the duration', () => {
    const out = resample(new Float32Array([0, 1, 0, -1]), 24_000, 48_000);
    expect(out).toHaveLength(8);
    expect(Array.from(out.slice(0, 4))).toEqual([0, 0.5, 1, 0.5]);
  });

  it('keeps the length in time for 44.1 kHz devices', () => {
    const second = new Float32Array(24_000);
    expect(resample(second, 24_000, 44_100)).toHaveLength(44_100);
  });

  it('leaves matching rates alone', () => {
    const same = new Float32Array([0.25]);
    expect(resample(same, 24_000, 24_000)).toBe(same);
  });
});

describe('concatBytes', () => {
  it('joins pieces in order', () => {
    expect(Array.from(concatBytes([new Uint8Array([1, 2]), new Uint8Array([3])]))).toEqual([
      1, 2, 3,
    ]);
  });
});
