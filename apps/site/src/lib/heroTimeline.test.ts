import { describe, expect, it } from 'vitest';
import { EXAMPLE_CLIMB, EXAMPLE_MISS } from './example.ts';
import { heroTimeline, words } from './heroTimeline.ts';

describe('heroTimeline', () => {
  const events = heroTimeline(EXAMPLE_CLIMB, EXAMPLE_MISS.rung);

  it('passes every rung before the miss, then misses once and ends', () => {
    const passes = events.filter((e) => e.kind === 'pass').map((e) => ('rung' in e ? e.rung : -1));
    expect(passes).toEqual([0, 1, 2, 3]);
    expect(events.filter((e) => e.kind === 'miss')).toEqual([expect.objectContaining({ rung: 4 })]);
    expect(events.at(-1)?.kind).toBe('end');
  });

  it('shows each question in full before its answer starts', () => {
    for (let rung = 0; rung <= EXAMPLE_MISS.rung; rung++) {
      const q = events.filter((e) => e.kind === 'question' && e.rung === rung);
      const a = events.filter((e) => e.kind === 'answer' && e.rung === rung);
      expect(q.at(-1)).toMatchObject({ words: words(EXAMPLE_CLIMB[rung]!.q).length });
      expect(a[0]!.at).toBeGreaterThan(q.at(-1)!.at);
    }
  });

  it('runs in time order and stays short enough to watch', () => {
    for (let i = 1; i < events.length; i++)
      expect(events[i]!.at).toBeGreaterThanOrEqual(events[i - 1]!.at);
    const total = events.at(-1)!.at;
    expect(total).toBeGreaterThan(8_000);
    expect(total).toBeLessThan(25_000);
  });

  it('refuses a climb that runs out before the miss', () => {
    expect(() => heroTimeline(EXAMPLE_CLIMB.slice(0, 2), 4)).toThrow();
  });
});
