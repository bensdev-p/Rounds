import { describe, expect, it } from 'vitest';
import {
  ProfileSchema,
  answerTimeLimit,
  answerTimeoutLabel,
  newProfile,
  rotationPool,
  rotationStartForWeek,
  shouldAskToSignIn,
  weekOfRotation,
} from './profile.ts';

// Thursday 13 November 2026, the day in home.png.
const THU = new Date(2026, 10, 13, 9, 41);

describe('newProfile', () => {
  it('fills in the defaults for what onboarding does not ask', () => {
    expect(newProfile({ year: 'MS3', rotation: 'IM' })).toEqual({
      year: 'MS3',
      rotation: 'IM',
      rotation_started_on: null,
      rotation_weeks: null,
      daily_goal: 3,
      persona: 'teacher',
      answer_timeout: 'persona',
    });
  });

  it('rejects a start without a length', () => {
    const p = newProfile({ year: 'MS3', rotation: 'IM' });
    expect(ProfileSchema.safeParse({ ...p, rotation_started_on: '2026-11-02' }).success).toBe(
      false,
    );
    expect(
      ProfileSchema.safeParse({ ...p, rotation_started_on: '2026-11-02', rotation_weeks: 8 })
        .success,
    ).toBe(true);
  });

  it('keeps the goal between 1 and 5', () => {
    const p = newProfile({ year: 'MS3', rotation: 'IM' });
    expect(ProfileSchema.safeParse({ ...p, daily_goal: 0 }).success).toBe(false);
    expect(ProfileSchema.safeParse({ ...p, daily_goal: 6 }).success).toBe(false);
  });
});

describe('rotationStartForWeek', () => {
  it('counts back from this Monday', () => {
    expect(rotationStartForWeek(1, THU)).toBe('2026-11-09');
    expect(rotationStartForWeek(3, THU)).toBe('2026-10-26');
  });

  it('treats Sunday as the end of the week, not the start', () => {
    expect(rotationStartForWeek(1, new Date(2026, 10, 15))).toBe('2026-11-09');
    expect(rotationStartForWeek(1, new Date(2026, 10, 16))).toBe('2026-11-16');
  });
});

describe('weekOfRotation', () => {
  const started = (week: number) => ({
    rotation_started_on: rotationStartForWeek(week, THU),
    rotation_weeks: 8,
  });

  it('gives "Week 3 of 8" for a student who said week 3', () => {
    expect(weekOfRotation(started(3), THU)).toEqual({ week: 3, of: 8 });
  });

  it('turns over on Monday', () => {
    expect(weekOfRotation(started(3), new Date(2026, 10, 15, 23))).toEqual({ week: 3, of: 8 });
    expect(weekOfRotation(started(3), new Date(2026, 10, 16, 0, 5))).toEqual({ week: 4, of: 8 });
  });

  it('is left out when unset, before the start and after the end', () => {
    expect(weekOfRotation({ rotation_started_on: null, rotation_weeks: null }, THU)).toBeNull();
    expect(
      weekOfRotation({ rotation_started_on: '2026-11-16', rotation_weeks: 8 }, THU),
    ).toBeNull();
    expect(
      weekOfRotation({ rotation_started_on: '2026-09-14', rotation_weeks: 8 }, THU),
    ).toBeNull();
    expect(weekOfRotation({ rotation_started_on: '2026-09-21', rotation_weeks: 8 }, THU)).toEqual({
      week: 8,
      of: 8,
    });
  });

  it('counts calendar days across the clock change', () => {
    // US clocks went back on 1 November 2026.
    expect(
      weekOfRotation(
        { rotation_started_on: '2026-10-26', rotation_weeks: 4 },
        new Date(2026, 10, 2, 0, 30),
      ),
    ).toEqual({ week: 2, of: 4 });
  });
});

describe('answerTimeLimit', () => {
  it("uses the persona's limit by default", () => {
    expect(answerTimeLimit('surgeon', 'persona')).toBe(10_000);
    expect(answerTimeLimit('teacher', 'persona')).toBeNull();
  });

  it('lets Settings override it', () => {
    expect(answerTimeLimit('surgeon', '60s')).toBe(60_000);
    expect(answerTimeLimit('teacher', '10s')).toBe(10_000);
    expect(answerTimeLimit('internist', 'off')).toBeNull();
  });

  it('labels each choice', () => {
    expect(answerTimeoutLabel('persona')).toBe('Persona default');
    expect(answerTimeoutLabel('30s')).toBe('30 s');
    expect(answerTimeoutLabel('off')).toBe('No limit');
  });
});

describe('rotationPool', () => {
  const scripts = [
    { id: 'dka', rotation: ['IM' as const] },
    { id: 'appy', rotation: ['IM' as const, 'surgery' as const] },
  ];

  it("picks from the rotation's scripts", () => {
    expect(rotationPool('surgery', scripts)).toEqual({ scriptIds: ['appy'], fallback: false });
  });

  it('falls back to every script when the rotation has none', () => {
    expect(rotationPool('peds', scripts)).toEqual({ scriptIds: ['dka', 'appy'], fallback: true });
    expect(rotationPool('peds', [])).toEqual({ scriptIds: [], fallback: false });
  });
});

describe('shouldAskToSignIn', () => {
  it('asks an anonymous student once, after the first session', () => {
    expect(shouldAskToSignIn({ isAnonymous: true, finishedLadders: 0, alreadyAsked: false })).toBe(
      false,
    );
    expect(shouldAskToSignIn({ isAnonymous: true, finishedLadders: 1, alreadyAsked: false })).toBe(
      true,
    );
    expect(shouldAskToSignIn({ isAnonymous: true, finishedLadders: 4, alreadyAsked: true })).toBe(
      false,
    );
    expect(shouldAskToSignIn({ isAnonymous: false, finishedLadders: 1, alreadyAsked: false })).toBe(
      false,
    );
  });
});
