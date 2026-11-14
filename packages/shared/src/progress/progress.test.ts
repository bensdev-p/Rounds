import { describe, expect, it } from 'vitest';
import { TEST_SCRIPTS, testQuestionsFor } from '../fixtures/index.ts';
import { gradeLocally } from '../grading/localGrader.ts';
import { buildMissCard, RUNG_LABELS } from './missCard.ts';
import { personaLine } from './personaLines.ts';
import {
  collectionTiles,
  dayKey,
  masteryByRotation,
  shiftGrid,
  masteryFor,
  pickScript,
  rankFor,
  roundsToday,
  shiftStreak,
  summarizeResult,
  usageSummary,
  type SessionRecord,
} from './progression.ts';

/** Local time on a November 2026 day, so tests don't depend on the time zone. */
const nov = (day: number, hour = 9): Date => new Date(2026, 10, day, hour);

function session(day: number, score = 3, script_id = 'a', hour = 9): SessionRecord {
  return {
    script_id,
    score,
    status: score === 6 ? 'completed' : 'missed',
    ended_at: nov(day, hour).toISOString(),
  };
}

/** `n` sessions on each listed day: enough to finish rounds. */
const shifts = (days: number[], n = 3): SessionRecord[] =>
  days.flatMap((d) => Array.from({ length: n }, (_, i) => session(d, 1, 'a', 8 + i)));

describe('dayKey', () => {
  it('uses the local calendar day', () => {
    expect(dayKey(nov(13, 23))).toBe('2026-11-13');
    expect(dayKey(nov(3, 0))).toBe('2026-11-03');
  });
});

describe('roundsToday', () => {
  it('counts sessions finished today toward the goal', () => {
    const r = roundsToday([session(12), session(13), session(13, 2, 'b')], nov(13, 18));
    expect(r).toEqual({ done: 2, goal: 3, complete: false });
  });
  it('is complete at the goal', () => {
    expect(roundsToday(shifts([13]), nov(13, 18)).complete).toBe(true);
  });
});

describe('shiftStreak', () => {
  // Nov 2026: Mon 9, Tue 10, ... Fri 13, Mon 16.
  it('counts consecutive shifts ending today', () => {
    expect(shiftStreak(shifts([11, 12, 13]), nov(13, 20))).toMatchObject({ count: 3, today: true });
  });
  it("keeps yesterday's streak alive while today isn't finished", () => {
    const s = shiftStreak([...shifts([11, 12]), session(13)], nov(13, 20));
    expect(s).toMatchObject({ count: 2, today: false });
  });
  it('forgives one post-call day per week', () => {
    const s = shiftStreak(shifts([9, 10, 12, 13]), nov(13, 20));
    expect(s).toEqual({ count: 4, today: true, postCall: ['2026-11-11'] });
  });
  it('breaks on a second missed day in the same week', () => {
    const s = shiftStreak(shifts([9, 11, 13]), nov(13, 20));
    expect(s.count).toBe(2);
    expect(s.postCall).toEqual(['2026-11-12']);
  });
  it('breaks on two missed days in a row', () => {
    expect(shiftStreak(shifts([6, 9, 10]), nov(10, 20)).count).toBe(2);
  });
  it('forgives one day in each week', () => {
    // Fri 6 missed (week of Nov 2), Wed 11 missed (week of Nov 9).
    const s = shiftStreak(shifts([4, 5, 7, 8, 9, 10, 12, 13]), nov(13, 20));
    expect(s.count).toBe(8);
    expect(s.postCall).toEqual(['2026-11-11', '2026-11-06']);
  });
  it('does not count a forgiven day before the first shift', () => {
    expect(shiftStreak(shifts([12, 13]), nov(13, 20))).toEqual({
      count: 2,
      today: true,
      postCall: [],
    });
  });
  it('is zero with no shifts, without fuss', () => {
    expect(shiftStreak([session(13)], nov(13, 20))).toEqual({ count: 0, today: false, postCall: [] });
  });
  it('resets quietly after a long gap', () => {
    expect(shiftStreak(shifts([1, 2, 3]), nov(13, 20)).count).toBe(0);
  });
});

describe('rankFor', () => {
  it.each([
    [0, 'MS3', 150],
    [149, 'MS3', 1],
    [150, 'Sub-I', 350],
    [816, 'Intern', 384],
    [1_200, 'Resident', 1_300],
    [5_000, 'Attending', null],
    [9_999, 'Attending', null],
  ])('%i rungs is %s', (total, title, toNext) => {
    const rank = rankFor(total);
    expect(rank.title).toBe(title);
    expect(rank.toNext).toBe(toNext);
  });
  it('reports progress toward the next rank', () => {
    expect(rankFor(850).progress).toBeCloseTo(350 / 700);
    expect(rankFor(6_000).progress).toBe(1);
  });
});

describe('masteryFor', () => {
  it('is not tried with no sessions', () => {
    expect(masteryFor('a', [], nov(13))).toBe('not_tried');
  });
  it('needs rung 6 on two different days', () => {
    expect(masteryFor('a', [session(12, 6), session(12, 6, 'a', 15)], nov(13))).toBe(
      'in_progress',
    );
    expect(masteryFor('a', [session(12, 6), session(13, 6)], nov(13))).toBe('mastered');
  });
  it('becomes re-check due 30 days after the last top run', () => {
    const runs = [session(1, 6), session(2, 6)];
    expect(masteryFor('a', runs, new Date(2026, 11, 2))).toBe('mastered');
    expect(masteryFor('a', runs, new Date(2026, 11, 3))).toBe('recheck_due');
    expect(masteryFor('a', [...runs, session(30, 6)], new Date(2026, 11, 3))).toBe('mastered');
  });
  it('ignores other scripts', () => {
    expect(masteryFor('b', [session(12, 6), session(13, 6)], nov(13))).toBe('not_tried');
  });
});

describe('summarizeResult', () => {
  it('reports a miss with its previous best', () => {
    const r = summarizeResult({
      before: [session(12, 5)],
      session: session(13, 4),
      anyPartial: false,
      now: nov(13, 10),
    });
    expect(r).toMatchObject({ score: 4, previousBest: 5, newBest: false, badges: [] });
    expect(r.rounds.done).toBe(1);
  });
  it('gives clean run and script mastered, at most two badges', () => {
    const r = summarizeResult({
      before: [session(12, 6), session(12, 5, 'a', 11)],
      session: session(13, 6),
      anyPartial: false,
      now: nov(13, 10),
    });
    expect(r.newBest).toBe(false);
    expect(r.badges).toEqual(['clean_run', 'script_mastered']);
  });
  it('gives new best but no clean run after partial credit', () => {
    const r = summarizeResult({
      before: [session(12, 5)],
      session: session(13, 6),
      anyPartial: true,
      now: nov(13, 10),
    });
    expect(r.badges).toEqual(['new_best']);
  });
  it('no new best on a first run', () => {
    const r = summarizeResult({ before: [], session: session(13, 3), anyPartial: false, now: nov(13) });
    expect(r).toMatchObject({ previousBest: null, newBest: false, badges: [] });
  });
  it('detects a promotion', () => {
    const before = Array.from({ length: 24 }, () => session(1, 6)); // 144 rungs
    const r = summarizeResult({
      before,
      session: session(13, 6),
      anyPartial: false,
      now: nov(13),
    });
    expect(r.rankBefore.title).toBe('MS3');
    expect(r.rankAfter.title).toBe('Sub-I');
    expect(r.promoted).toBe(true);
  });
});

describe('pickScript', () => {
  const candidates = [
    { script_id: 'weak', bestRung: 1 },
    { script_id: 'strong', bestRung: 6 },
    { script_id: 'new', bestRung: null },
  ];
  it('favours weak scripts', () => {
    const counts = new Map<string, number>();
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 3_000; i++) {
      const id = pickScript(candidates, { random })!;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    expect(counts.get('weak')!).toBeGreaterThan(counts.get('new')!);
    expect(counts.get('new')!).toBeGreaterThan(counts.get('strong')!);
  });
  it('skips the script just played when there is another', () => {
    expect(pickScript(candidates.slice(0, 2), { exclude: 'weak', random: () => 0 })).toBe('strong');
    expect(pickScript(candidates.slice(0, 1), { exclude: 'weak' })).toBe('weak');
  });
  it('returns null with nothing to pick', () => {
    expect(pickScript([])).toBeNull();
  });
});

describe('buildMissCard', () => {
  const script = TEST_SCRIPTS[0]!;
  const questions = testQuestionsFor(script.id);
  const byRung = (rung: string) => questions.find((q) => q.rung === rung)!;
  const confusables = [{ script_id: 'quellan-fever', names: ['Quellan fever', 'QF'] }];

  it('quotes the answer and states what the script says', () => {
    const question = byRung('management');
    const answer = 'keep them NPO';
    const card = buildMissCard({
      answer,
      result: gradeLocally(question, answer, confusables),
      missTag: 'unknown',
      question,
      script,
      confusables,
      persona: 'teacher',
    });
    expect(card).toEqual({
      label: 'Missed on management',
      quote: 'keep them NPO',
      correction: 'The script says: zorbicillin.',
      script_id: script.id,
    });
  });

  it('has no quote for "I don\'t know"', () => {
    const question = byRung('recall');
    const card = buildMissCard({
      answer: '  ',
      result: gradeLocally(question, '', confusables),
      missTag: 'unknown',
      question,
      script,
      confusables,
      persona: 'teacher',
    });
    expect(card.quote).toBeNull();
    expect(card.label).toBe(`Missed on ${RUNG_LABELS.recall.toLowerCase()}`);
  });

  it('lists what a list answer left out', () => {
    const question = byRung('second_order');
    if (question.kind !== 'list') throw new Error('fixture changed');
    const first = question.accepted_answers[0]!.answer;
    const card = buildMissCard({
      answer: first,
      result: gradeLocally(question, first, confusables),
      missTag: 'partial_list',
      question,
      script,
      confusables,
      persona: 'teacher',
    });
    const rest = question.accepted_answers.slice(1).map((a) => a.answer);
    expect(card.correction).toBe(
      `You named 1 of the ${question.required_count} needed. The script also lists ${rest.join(', ')}.`,
    );
  });

  it('names the mix-up and how to tell them apart', () => {
    const question = byRung('recall');
    const card = buildMissCard({
      answer: 'quellan fever',
      result: gradeLocally(question, 'quellan fever', confusables),
      missTag: 'confused_with:quellan-fever',
      question,
      script,
      confusables,
      persona: 'teacher',
    });
    expect(card.correction).toMatch(/^That fits Quellan fever\. .+ The script says: /);
  });

  it('explains a slow answer with the persona limit', () => {
    const question = byRung('recall');
    const answer = question.accepted_answers[0]!.answer;
    const card = buildMissCard({
      answer,
      result: gradeLocally(question, answer, confusables),
      missTag: 'slow',
      question,
      script,
      confusables,
      persona: 'surgeon',
    });
    expect(card.correction).toBe('Right answer, but the Surgeon wanted it inside 10 seconds.');
  });

  it('shortens a long quote', () => {
    const question = byRung('management');
    const answer = 'word '.repeat(60);
    const card = buildMissCard({
      answer,
      result: gradeLocally(question, answer, confusables),
      missTag: 'unknown',
      question,
      script,
      confusables,
      persona: 'teacher',
    });
    expect(card.quote!.length).toBeLessThanOrEqual(120);
    expect(card.quote!.endsWith('…')).toBe(true);
  });
});

describe('personaLine', () => {
  it('is stable for a seed and differs by persona', () => {
    expect(personaLine('internist', 'promotion', 0)).toBe(
      "Congratulations. You're still presenting to me at six.",
    );
    expect(personaLine('surgeon', 'top', 7)).toBe(personaLine('surgeon', 'top', 7));
    expect(personaLine('teacher', 'top', -3)).toBeTruthy();
  });
});

describe('shiftGrid', () => {
  it('covers the last 28 days, oldest first, with levels against the goal', () => {
    const grid = shiftGrid([...shifts([12]), session(13), ...shifts([11], 4)], nov(13, 20));
    expect(grid).toHaveLength(28);
    expect(grid.at(-1)).toMatchObject({ day: '2026-11-13', sessions: 1, level: 1 });
    expect(grid.at(-2)).toMatchObject({ day: '2026-11-12', sessions: 3, level: 2 });
    expect(grid.at(-3)).toMatchObject({ day: '2026-11-11', sessions: 4, level: 3 });
    expect(grid[0]).toMatchObject({ day: '2026-10-17', level: 0 });
  });

  it('marks post-call days inside the streak', () => {
    const grid = shiftGrid(shifts([9, 10, 12, 13]), nov(13, 20));
    expect(grid.find((d) => d.day === '2026-11-11')).toMatchObject({ postCall: true, level: 0 });
    expect(grid.filter((d) => d.postCall)).toHaveLength(1);
  });

  it('uses the chosen goal', () => {
    expect(shiftGrid([session(13)], nov(13, 20), 1).at(-1)!.level).toBe(2);
  });
});

describe('masteryByRotation', () => {
  it('counts mastered scripts per rotation', () => {
    const scripts = [
      { id: 'a', rotation: ['IM'] },
      { id: 'b', rotation: ['IM', 'surgery'] },
    ];
    const sessions = [session(12, 6, 'b'), session(13, 6, 'b')];
    expect(masteryByRotation(scripts, sessions, nov(13))).toEqual([
      { rotation: 'IM', mastered: 1, total: 2 },
      { rotation: 'surgery', mastered: 1, total: 1 },
    ]);
  });
});

describe('collectionTiles', () => {
  it('sorts re-check due, in progress, new, then mastered', () => {
    const sessions = [
      session(12, 6, 'mastered'),
      session(13, 6, 'mastered'),
      session(13, 2, 'started'),
    ];
    const tiles = collectionTiles(['mastered', 'new', 'started'], sessions, nov(13));
    expect(tiles.map((t) => [t.script_id, t.status, t.best])).toEqual([
      ['started', 'in_progress', 2],
      ['new', 'not_tried', 0],
      ['mastered', 'mastered', 6],
    ]);
  });
});

describe('usageSummary', () => {
  it('counts active days and runs of consecutive days', () => {
    const sessions = [session(5, 2), session(6, 4), session(6, 6), session(7, 1), session(11), session(12), session(13)];
    const u = usageSummary(sessions, nov(13, 20));
    expect(u).toMatchObject({ sessions: 7, activeDays: 6, currentRun: 3, longestRun: 3, bestRung: 6 });
    expect(u.firstDay).toBe('2026-11-05');
    expect(u.recent[0]).toEqual({ day: '2026-11-13', sessions: 1, best: 3 });
    expect(u.recent[7]).toEqual({ day: '2026-11-06', sessions: 2, best: 6 });
  });

  it("keeps the run alive until today's over", () => {
    expect(usageSummary([session(11), session(12)], nov(13, 9)).currentRun).toBe(2);
    expect(usageSummary([session(10), session(11)], nov(13, 9)).currentRun).toBe(0);
  });

  it('handles no sessions', () => {
    expect(usageSummary([], nov(13))).toMatchObject({ sessions: 0, activeDays: 0, meanRung: 0, firstDay: null });
  });
});
