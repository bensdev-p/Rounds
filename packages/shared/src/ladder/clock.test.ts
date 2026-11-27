import { describe, expect, it } from 'vitest';
import { formatClock, readClock } from './clock.ts';

describe('formatClock', () => {
  it('rounds a countdown up and elapsed time down', () => {
    expect(formatClock(30_000, 'countdown')).toBe('0:30');
    expect(formatClock(29_001, 'countdown')).toBe('0:30');
    expect(formatClock(1, 'countdown')).toBe('0:01');
    expect(formatClock(0, 'countdown')).toBe('0:00');
    expect(formatClock(29_999)).toBe('0:29');
    expect(formatClock(65_000)).toBe('1:05');
    expect(formatClock(-500)).toBe('0:00');
  });
});

describe('readClock', () => {
  it('counts down per question with a time limit', () => {
    expect(readClock({ time_limit_ms: 30_000, question_ms: 0, session_ms: 90_000 })).toEqual({
      mode: 'countdown',
      ms: 30_000,
      text: '0:30',
      timeUp: false,
    });
    expect(readClock({ time_limit_ms: 10_000, question_ms: 7_400, session_ms: 0 }).text).toBe(
      '0:03',
    );
  });

  it('reads 0:00 and time up once the limit passes', () => {
    const reading = readClock({ time_limit_ms: 10_000, question_ms: 12_000, session_ms: 0 });
    expect(reading).toMatchObject({ ms: 0, text: '0:00', timeUp: true });
  });

  it('counts up the session when untimed', () => {
    expect(readClock({ time_limit_ms: null, question_ms: 50_000, session_ms: 42_300 })).toEqual({
      mode: 'elapsed',
      ms: 42_300,
      text: '0:42',
      timeUp: false,
    });
  });
});
