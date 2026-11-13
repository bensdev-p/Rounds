import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MISSED_RUNG, STEPS } from './session.ts';
import {
  BEATS,
  DURATION,
  END_CARD_LINE,
  FADE,
  MISS_FRAME,
  POSTER_FRAME,
  PROMOTION_CUT,
  PROMOTION_RISE_FRAMES,
  RUNG_PASSES,
  RUNG_PASS_FRAMES,
  SCENES,
  TAGLINE,
  cameraZoom,
  rungPass,
  scene,
  sceneAt,
  wordsShown,
} from './timeline.ts';

describe('timeline', () => {
  it('runs start to finish with no gaps or overlaps', () => {
    expect(SCENES[0]?.from).toBe(0);
    SCENES.slice(1).forEach((s, i) => expect(s.from).toBe(SCENES[i]?.to));
    expect(SCENES.at(-1)?.to).toBe(DURATION);
    expect(DURATION).toBe(1950);
    for (const s of SCENES) expect(Number.isInteger(s.from)).toBe(true);
  });

  it('keeps captions to 7 words, sentence case, and never says "pimp"', () => {
    const captions = SCENES.flatMap((s) => (s.caption ? [s.caption] : []));
    expect(captions).toHaveLength(7);
    for (const line of [...captions, TAGLINE, END_CARD_LINE]) {
      expect(line.toLowerCase()).not.toContain('pimp');
      expect(line[0]).toBe(line[0]?.toUpperCase());
    }
    for (const caption of captions) {
      expect(caption.split(/\s+/).length).toBeLessThanOrEqual(7);
    }
  });

  it('finds the scene for a frame', () => {
    expect(sceneAt(0).id).toBe('intro');
    expect(sceneAt(scene('climb').from - 1).id).toBe('session');
    expect(sceneAt(scene('climb').from).id).toBe('climb');
    expect(sceneAt(DURATION - 1).id).toBe('end');
  });

  it('uses the motion durations from DESIGN.md', () => {
    expect(RUNG_PASS_FRAMES).toBeCloseTo(8.4);
    expect(PROMOTION_RISE_FRAMES).toBe(12);
    expect(FADE).toBe(9);
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

describe('session schedule', () => {
  const climb = scene('climb');

  it('has one beat per rung asked, in order, on whole frames', () => {
    expect(BEATS).toHaveLength(STEPS.length);
    expect(STEPS).toHaveLength(MISSED_RUNG);
    BEATS.forEach((beat, i) => {
      expect(beat.questionStart).toBeGreaterThan(beat.start);
      expect(beat.answerStart).toBeGreaterThan(beat.questionEnd);
      expect(beat.verdict).toBeGreaterThan(beat.answerEnd);
      expect(Number.isInteger(beat.verdict)).toBe(true);
      if (i > 0) expect(beat.start).toBe(BEATS[i - 1]?.verdict);
    });
  });

  it('asks the first question before the climb scene and passes every rung inside it', () => {
    expect(BEATS[0]?.answerEnd).toBeLessThan(climb.from);
    expect(RUNG_PASSES).toHaveLength(MISSED_RUNG - 1);
    for (const at of RUNG_PASSES) {
      expect(at).toBeGreaterThan(climb.from);
      expect(at).toBeLessThan(MISS_FRAME);
    }
  });

  it('holds on the miss for at least a second before the result', () => {
    expect(climb.to - MISS_FRAME).toBeGreaterThanOrEqual(30);
    expect(climb.to - MISS_FRAME).toBeLessThanOrEqual(75);
  });

  it('takes the poster mid-climb, between the second and third pass', () => {
    expect(POSTER_FRAME).toBeGreaterThan((RUNG_PASSES[1] ?? 0) + RUNG_PASS_FRAMES);
    expect(POSTER_FRAME).toBeLessThan(RUNG_PASSES[2] ?? 0);
  });

  it('keeps the poster frame in package.json in step', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
      scripts: Record<string, string>;
    };
    const frames = [...(pkg.scripts['posters'] ?? '').matchAll(/--frame=(\d+)/g)].map((m) => Number(m[1]));
    expect(frames).toEqual([POSTER_FRAME, POSTER_FRAME]);
  });
});

describe('camera', () => {
  it('shows the whole phone when it enters and when it cuts to the promotion', () => {
    expect(cameraZoom(scene('session').from)).toBe(1);
    expect(cameraZoom(PROMOTION_CUT)).toBe(1);
  });

  it('never pushes in past 1.2 and never jumps', () => {
    for (let f = 1; f < DURATION; f++) {
      expect(cameraZoom(f)).toBeLessThanOrEqual(1.2);
      expect(Math.abs(cameraZoom(f) - cameraZoom(f - 1))).toBeLessThan(0.02);
    }
  });
});
