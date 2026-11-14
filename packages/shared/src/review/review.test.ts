import { describe, expect, it } from 'vitest';
import { TEST_QUESTIONS, TEST_SCRIPTS } from '../fixtures/index.ts';
import type { SessionRecord } from '../progress/progression.ts';
import type { MissTag } from '../schemas/attempt.ts';
import type { PatientLog } from '../schemas/patientLog.ts';
import type { Question } from '../schemas/question.ts';
import { drillQuestion, drillScore, pickDrill, startDrill, submitDrillAnswer } from './drill.ts';
import {
  comparisonRows,
  missedRows,
  missSubtitle,
  mixUpPair,
  patientsToPractise,
  reviewMinutes,
  timesThisWeek,
  windowStart,
  type MissRecord,
} from './review.ts';

/** Local time on a November 2026 day, so tests don't depend on the time zone. */
const nov = (day: number, hour = 9): Date => new Date(2026, 10, day, hour);
const NOW = nov(14, 21);

const byRung = (rung: Question['rung']) => TEST_QUESTIONS.find((q) => q.rung === rung)!;
const single = byRung('management');
const list = byRung('second_order');

let n = 0;
function miss(
  script_id: string,
  day: number,
  hour = 9,
  extra: Partial<MissRecord> = {},
): MissRecord {
  n += 1;
  return {
    attempt_id: `a${n}`,
    script_id,
    question: { ...single, script_id },
    miss_tag: 'unknown',
    matched: [],
    created_at: nov(day, hour).toISOString(),
    session_kind: 'ladder',
    ...extra,
  };
}

const ladder = (script_id: string, day: number, hour: number, score: number): SessionRecord => ({
  script_id,
  score,
  status: score === 6 ? 'completed' : 'missed',
  ended_at: nov(day, hour).toISOString(),
});

describe('windowStart', () => {
  it('starts at local midnight six days back', () => {
    expect(windowStart(NOW)).toBe(new Date(2026, 10, 8, 0).toISOString());
  });
});

describe('missedRows', () => {
  it('lists one row per script, oldest first', () => {
    const { rows, rolled } = missedRows(
      [miss('b', 14, 10), miss('a', 14, 8), miss('b', 14, 12)],
      [],
      NOW,
    );
    expect(rows.map((r) => r.script_id)).toEqual(['a', 'b']);
    expect(rows[1]!.miss.created_at).toBe(nov(14, 12).toISOString());
    expect(rolled).toBe(0);
  });

  it('shows at most five and rolls the rest to tomorrow', () => {
    const misses = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id, i) => miss(id, 14, 8 + i));
    const { rows, rolled } = missedRows(misses, [], NOW);
    expect(rows.map((r) => r.script_id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(rolled).toBe(2);
    // Tomorrow the oldest ones lead, so the rolled ones come up.
    const tomorrow = missedRows(misses, [], nov(15, 21));
    expect(tomorrow.rows.map((r) => r.script_id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('clears a miss once a later ladder gets past the missed rung', () => {
    // `single` is on management, rung 5.
    const m = miss('a', 13, 9);
    expect(missedRows([m], [ladder('a', 13, 10, 4)], NOW).rows).toHaveLength(1);
    expect(missedRows([m], [ladder('a', 13, 10, 5)], NOW).rows).toHaveLength(0);
    // A session that ended before the miss doesn't clear it.
    expect(missedRows([m], [ladder('a', 13, 8, 6)], NOW).rows).toHaveLength(1);
  });

  it('drops misses older than a week and drill misses', () => {
    expect(missedRows([miss('a', 7, 9)], [], NOW).rows).toHaveLength(0);
    expect(missedRows([miss('a', 8, 9)], [], NOW).rows).toHaveLength(1);
    expect(missedRows([miss('a', 14, 9, { session_kind: 'drill' })], [], NOW).rows).toEqual([]);
  });
});

describe('missSubtitle', () => {
  it("uses the miss card's label", () => {
    expect(missSubtitle({ question: single, matched: [] })).toBe('Missed on management');
  });

  it('names the list items left out', () => {
    expect(
      missSubtitle({ question: list, matched: ['glimmer exposure', 'family history'] }),
    ).toBe('Missed night shift work, low blorp diet');
  });

  it('falls back to the label when nothing on the list was named', () => {
    expect(missSubtitle({ question: list, matched: [] })).toBe('Missed on next most common');
  });

  it('keeps a long list short', () => {
    const long: Question = {
      ...list,
      accepted_answers: ['a', 'b', 'c', 'd', 'e', 'f'].map((answer) => ({ answer, synonyms: [] })),
    };
    expect(missSubtitle({ question: long, matched: ['a'] })).toBe('Missed b, c, d and 2 more');
  });
});

describe('mixUpPair', () => {
  const tag = (id: string): MissTag => `confused_with:${id}`;

  it('needs the same pair twice in a week', () => {
    expect(mixUpPair([miss('x', 14, 9, { miss_tag: tag('y') })], NOW)).toBeNull();
    expect(
      mixUpPair(
        [miss('x', 7, 9, { miss_tag: tag('y') }), miss('x', 14, 9, { miss_tag: tag('y') })],
        NOW,
      ),
    ).toBeNull();
  });

  it('counts the pair either way round, drills included', () => {
    const pair = mixUpPair(
      [
        miss('x', 12, 9, { miss_tag: tag('y') }),
        miss('y', 13, 9, { miss_tag: tag('x'), session_kind: 'drill' }),
        miss('x', 14, 9, { miss_tag: tag('y') }),
      ],
      NOW,
    );
    expect(pair).toEqual({ script_id: 'x', other_id: 'y', count: 3 });
  });

  it('picks the most frequent pair, then the latest', () => {
    const misses = [
      miss('a', 12, 9, { miss_tag: tag('b') }),
      miss('a', 12, 10, { miss_tag: tag('b') }),
      miss('c', 13, 9, { miss_tag: tag('d') }),
      miss('d', 14, 9, { miss_tag: tag('c') }),
    ];
    expect(mixUpPair(misses, NOW)).toEqual({ script_id: 'd', other_id: 'c', count: 2 });
    misses.push(miss('b', 11, 9, { miss_tag: tag('a') }));
    expect(mixUpPair(misses, NOW)).toMatchObject({ script_id: 'a', count: 3 });
  });

  it('says how many times', () => {
    expect(timesThisWeek(3)).toBe('3 times this week');
  });
});

describe('comparisonRows', () => {
  const [zorblax, quellan] = TEST_SCRIPTS;

  it('lines up both sides by label', () => {
    expect(comparisonRows(zorblax!, quellan!)).toEqual([
      {
        label: 'Nails',
        left: { label: 'Nails', text: 'Blue nail beds', source_field: 'key_findings.exam[0]' },
        right: { label: 'Nails', text: 'Green nail beds', source_field: 'key_findings.exam[0]' },
      },
      {
        label: 'Blorp',
        left: { label: 'Blorp', text: 'High', source_field: 'key_findings.labs[0]' },
        right: { label: 'Blorp', text: 'Normal', source_field: 'key_findings.labs[0]' },
      },
    ]);
  });

  it('gives up when a side has no rows or the labels differ', () => {
    const bare = { ...quellan!, confused_with: [{ script_id: zorblax!.id, how_to_tell_apart: 'x' }] };
    expect(comparisonRows(zorblax!, bare)).toBeNull();
    const link = quellan!.confused_with[0]!;
    const other = {
      ...quellan!,
      confused_with: [{ ...link, compare: link.compare!.slice().reverse() }],
    };
    expect(comparisonRows(zorblax!, other)).toBeNull();
  });
});

describe('patientsToPractise', () => {
  const log = (id: string, script_id: string | null, hour: number): PatientLog => ({
    id,
    label: script_id ?? 'Something odd',
    script_id,
    rotation: 'IM',
    logged_at: nov(14, hour).toISOString(),
  });

  it('keeps scripts not yet pimped today, once each', () => {
    const logs = [log('1', 'a', 8), log('2', null, 9), log('3', 'b', 10), log('4', 'a', 11)];
    expect(patientsToPractise(logs, [], NOW).map((l) => l.id)).toEqual(['1', '3']);
    expect(patientsToPractise(logs, [ladder('a', 14, 12, 2)], NOW).map((l) => l.id)).toEqual([
      '3',
    ]);
  });
});

describe('reviewMinutes', () => {
  it('allows four minutes an item', () => {
    expect(reviewMinutes(3)).toBe('About 12 minutes');
    expect(reviewMinutes(0)).toBe('About 4 minutes');
  });
});

describe('drill', () => {
  const diff = (script_id: string, i: number): Question => ({
    ...byRung('differentiate'),
    id: `${script_id}.differentiate.${i}`,
    script_id,
  });
  const left = [diff('x', 1), diff('x', 2), diff('x', 3), { ...single, script_id: 'x' }];
  const right = [diff('y', 1)];
  const correct = {
    answer: 'blue nail beds',
    elapsed_ms: 1000,
    result: {
      grade: 'correct' as const,
      reason: 'Correct.',
      matched: ['blue nail beds'],
      confused_with_script_id: null,
    },
  };

  it('takes turns, differentiate questions only, two per script at most', () => {
    const picked = pickDrill(left, right, { random: () => 0 });
    expect(picked.map((q) => q.script_id)).toEqual(['x', 'y', 'x']);
    expect(picked.every((q) => q.rung === 'differentiate')).toBe(true);
  });

  it('ends on the first miss and scores the answers before it', () => {
    let state = startDrill(['x', 'y'], pickDrill(left, right, { random: () => 0 }), 'teacher');
    state = submitDrillAnswer(state, correct);
    expect(state.attempts[0]!.matched).toEqual(['blue nail beds']);
    expect(drillQuestion(state)?.script_id).toBe('y');
    state = submitDrillAnswer(state, {
      ...correct,
      answer: 'quellan',
      result: { ...correct.result, grade: 'incorrect', matched: [], confused_with_script_id: 'x' },
    });
    expect(state.status).toBe('missed');
    expect(state.attempts[1]!.miss_tag).toBe('confused_with:x');
    expect(drillScore(state)).toBe(1);
    expect(drillQuestion(state)).toBeNull();
  });

  it('completes after the last question', () => {
    let state = startDrill(['x', 'y'], [diff('x', 1)], 'teacher');
    state = submitDrillAnswer(state, correct);
    expect(state.status).toBe('completed');
  });

  it('refuses questions from outside the pair', () => {
    expect(() => startDrill(['x', 'y'], [diff('z', 1)], 'teacher')).toThrow();
    expect(() => startDrill(['x', 'y'], [], 'teacher')).toThrow();
  });
});
