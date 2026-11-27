import { describe, expect, it } from 'vitest';
import { TEST_QUESTION_VARIANTS, TEST_QUESTIONS } from '../fixtures/index.ts';
import { RUNGS } from '../schemas/question.ts';
import {
  dailyShareText,
  dailySquares,
  dayNumber,
  localDayKey,
  longDay,
  pickDailyLadder,
  pickDailyScript,
  shortDay,
} from './daily.ts';

const POOL = ['acute-pancreatitis', 'appendicitis', 'dka', 'pneumonia', 'sepsis'];

function dayAfter(day: string, n: number): string {
  return new Date((dayNumber(day) + n) * 86_400_000).toISOString().slice(0, 10);
}

describe('days', () => {
  it('uses the local calendar date', () => {
    expect(localDayKey(new Date(2026, 10, 16, 23, 59))).toBe('2026-11-16');
    expect(localDayKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });

  it('formats the day for the page and the share line', () => {
    expect(shortDay('2026-11-16')).toBe('Nov 16');
    expect(longDay('2026-11-16')).toBe('Monday, November 16');
  });

  it('rejects anything that is not a real day', () => {
    expect(() => dayNumber('2026-02-30')).toThrow();
    expect(() => dayNumber('16/11/2026')).toThrow();
  });
});

describe('pickDailyScript', () => {
  it('is the same for everyone on the same day, whatever order the pool comes in', () => {
    const a = pickDailyScript(POOL, '2026-11-16');
    expect(a).toBe(pickDailyScript([...POOL].reverse(), '2026-11-16'));
    expect(POOL).toContain(a);
  });

  it('shows every script once before any repeats', () => {
    // Start of a cycle: day numbers divisible by the pool size.
    const start = new Date(Math.ceil(dayNumber('2026-11-16') / 5) * 5 * 86_400_000)
      .toISOString()
      .slice(0, 10);
    for (let cycle = 0; cycle < 4; cycle++) {
      const picks = Array.from({ length: 5 }, (_, i) =>
        pickDailyScript(POOL, dayAfter(start, cycle * 5 + i)),
      );
      expect(new Set(picks).size).toBe(5);
    }
  });

  it('never repeats a script on two days in a row', () => {
    let previous = pickDailyScript(POOL, '2026-01-01');
    for (let i = 1; i < 400; i++) {
      const pick = pickDailyScript(POOL, dayAfter('2026-01-01', i));
      expect(pick).not.toBe(previous);
      previous = pick;
    }
  });

  it('handles an empty or single-script pool', () => {
    expect(pickDailyScript([], '2026-11-16')).toBeNull();
    expect(pickDailyScript(['dka'], '2026-11-16')).toBe('dka');
  });
});

describe('pickDailyLadder', () => {
  const questions = [...TEST_QUESTIONS, ...TEST_QUESTION_VARIANTS].filter(
    (q) => q.script_id === TEST_QUESTIONS[0]!.script_id,
  );

  it('asks one question per rung, the same for everyone that day', () => {
    const ladder = pickDailyLadder(questions, '2026-11-16');
    expect(ladder.map((q) => q.rung)).toEqual(
      RUNGS.filter((r) => questions.some((q) => q.rung === r)),
    );
    expect(pickDailyLadder([...questions].reverse(), '2026-11-16').map((q) => q.id)).toEqual(
      ladder.map((q) => q.id),
    );
  });
});

describe('the share line', () => {
  it('shows the squares and the score only', () => {
    const outcome = { cleared: 4, missed: true, total: 6 };
    expect(dailySquares(outcome)).toEqual([
      'cleared',
      'cleared',
      'cleared',
      'cleared',
      'missed',
      'unreached',
    ]);
    expect(dailyShareText('2026-11-16', outcome)).toBe(
      '🟩🟩🟩🟩🟥⬛\nPimpMe · Nov 16 · 4/6 · pimpme.app/daily',
    );
  });

  it('shows a clean run as all green', () => {
    expect(dailyShareText('2026-11-16', { cleared: 6, missed: false, total: 6 })).toBe(
      '🟩🟩🟩🟩🟩🟩\nPimpMe · Nov 16 · 6/6 · pimpme.app/daily',
    );
  });

  it('shows a miss on the first rung', () => {
    expect(dailySquares({ cleared: 0, missed: true, total: 6 })[0]).toBe('missed');
  });
});
