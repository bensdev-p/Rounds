import { describe, expect, it } from 'vitest';
import {
  DURATION,
  END_CARD_LINE,
  FADE,
  POSTER_FRAME,
  PROMOTION_RISE_FRAMES,
  RUNG_PASSES,
  RUNG_PASS_FRAMES,
  SCENES,
  rungPass,
  scene,
  sceneAt,
  wordsShown,
} from './timeline.ts';

describe('timeline', () => {
  it('covers 0–1650 with no gaps or overlaps', () => {
    expect(SCENES[0]?.from).toBe(0);
    SCENES.slice(1).forEach((s, i) => expect(s.from).toBe(SCENES[i]?.to));
    expect(SCENES.at(-1)?.to).toBe(DURATION);
    expect(DURATION).toBe(1650);
  });

  it('keeps captions to 7 words, sentence case, and never says "pimp"', () => {
    const captions = SCENES.flatMap((s) => (s.caption ? [s.caption] : []));
    expect(captions).toHaveLength(6);
    for (const caption of [...captions, END_CARD_LINE]) {
      expect(caption.toLowerCase()).not.toContain('pimp');
      expect(caption[0]).toBe(caption[0]?.toUpperCase());
    }
    for (const caption of captions) {
      expect(caption.split(/\s+/).length).toBeLessThanOrEqual(7);
    }
  });

  it('finds the scene for a frame', () => {
    expect(sceneAt(0).id).toBe('intro');
    expect(sceneAt(359).id).toBe('session');
    expect(sceneAt(360).id).toBe('climb');
    expect(sceneAt(1649).id).toBe('end');
  });

  it('uses the motion durations from DESIGN.md', () => {
    expect(RUNG_PASS_FRAMES).toBeCloseTo(8.4);
    expect(PROMOTION_RISE_FRAMES).toBe(12);
    expect(FADE).toBe(9);
  });

  it('passes both rungs inside scene 3, before the poster frame', () => {
    const climb = scene('climb');
    for (const at of RUNG_PASSES) {
      expect(at).toBeGreaterThan(climb.from);
      expect(at + RUNG_PASS_FRAMES).toBeLessThan(POSTER_FRAME);
    }
    expect(POSTER_FRAME).toBeLessThan(climb.to);
  });

  it('rung pass starts at 0, overshoots slightly, and settles at 1', () => {
    expect(rungPass(99, 100)).toEqual({ fill: 0, pop: 0 });
    const peak = Math.max(...Array.from({ length: 9 }, (_, i) => rungPass(100 + i, 100).pop));
    expect(peak).toBeGreaterThan(1);
    expect(peak).toBeLessThan(1.15);
    const settled = rungPass(120, 100);
    expect(settled.fill).toBe(1);
    expect(settled.pop).toBeCloseTo(1);
  });

  it('types about 8 words a second', () => {
    expect(wordsShown(9, 10)).toBe(0);
    expect(wordsShown(10, 10)).toBe(1);
    expect(wordsShown(40, 10)).toBe(9);
  });
});
