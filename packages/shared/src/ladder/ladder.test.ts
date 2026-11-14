import { describe, expect, it } from 'vitest';
import { TEST_QUESTIONS, TEST_SCRIPTS } from '../fixtures/index.ts';
import { confusablesFor, gradeLocally } from '../grading/localGrader.ts';
import type { GradeResult } from '../schemas/attempt.ts';
import { RUNGS, type ListQuestion, type Question } from '../schemas/question.ts';
import {
  bestRung,
  clearedRungs,
  currentQuestion,
  endingMiss,
  ladderScore,
  LadderError,
  pickLadder,
  startLadder,
  submitAnswer,
  type LadderState,
} from './engine.ts';
import { classifyMiss } from './missTags.ts';
import { PERSONAS, type PersonaId } from './personas.ts';

const confusables = confusablesFor(TEST_SCRIPTS[0]!, TEST_SCRIPTS);
const recall = TEST_QUESTIONS[0]!;
const list = TEST_QUESTIONS.find((q): q is ListQuestion => q.kind === 'list')!;

const CORRECT: Record<string, string> = {
  'zorblax-syndrome.recall.1': 'Zorblax syndrome',
  'zorblax-syndrome.second-order.1': 'glimmer, night shift work, low blorp diet',
  'zorblax-syndrome.differentiate.1': 'blue nail beds',
  'zorblax-syndrome.workup.1': 'anti-glimmer antibody',
  'zorblax-syndrome.management.1': 'zorbicillin',
  'zorblax-syndrome.pearl.1': 'fever',
};

function answer(state: LadderState, text: string, elapsed_ms = 1000): LadderState {
  const q = currentQuestion(state)!;
  return submitAnswer(state, {
    answer: text,
    elapsed_ms,
    result: gradeLocally(q, text, confusables),
  });
}

function answerCorrectly(state: LadderState, times: number): LadderState {
  let s = state;
  for (let i = 0; i < times; i++) s = answer(s, CORRECT[currentQuestion(s)!.id]!);
  return s;
}

const miss = (
  question: Question,
  result: Partial<GradeResult>,
  elapsed_ms = 0,
  persona: PersonaId = 'teacher',
) =>
  classifyMiss({
    question,
    result: {
      grade: 'incorrect',
      reason: 'x',
      matched: [],
      confused_with_script_id: null,
      ...result,
    },
    elapsed_ms,
    time_limit_ms: PERSONAS[persona].time_limit_ms,
  });

describe('classifyMiss', () => {
  it('returns null for a passing answer', () => {
    expect(miss(recall, { grade: 'correct', matched: ['Zorblax syndrome'] })).toBeNull();
  });

  it('tags unknown, confused_with and partial_list', () => {
    expect(miss(recall, {})).toBe('unknown');
    expect(miss(recall, { confused_with_script_id: 'quellan-fever' })).toBe(
      'confused_with:quellan-fever',
    );
    expect(miss(list, { grade: 'partial', matched: ['glimmer exposure'] })).toBe('partial_list');
    expect(miss(list, {})).toBe('unknown');
  });

  it('tags slow only when the content was right', () => {
    const late = PERSONAS.surgeon.time_limit_ms + 1;
    expect(miss(recall, { grade: 'correct' }, late, 'surgeon')).toBe('slow');
    expect(miss(recall, {}, late, 'surgeon')).toBe('unknown');
    expect(miss(recall, { grade: 'correct' }, 10 * 60_000, 'teacher')).toBeNull();
  });

  it('passes a list answer above the threshold even if not complete', () => {
    expect(
      miss(list, { grade: 'partial', matched: ['glimmer exposure', 'family history'] }),
    ).toBeNull();
  });
});

describe('ladder engine', () => {
  it('sorts questions by rung', () => {
    const shuffled = [...TEST_QUESTIONS].reverse();
    expect(startLadder(shuffled).questions.map((q) => q.rung)).toEqual([...RUNGS]);
  });

  it('rejects empty and mixed-script ladders', () => {
    expect(() => startLadder([])).toThrow(LadderError);
    expect(() =>
      startLadder([recall, { ...recall, id: 'x.y', script_id: 'quellan-fever' }]),
    ).toThrow(LadderError);
  });

  it('climbs to the top when every answer is right', () => {
    const end = answerCorrectly(startLadder(TEST_QUESTIONS), RUNGS.length);
    expect(end.status).toBe('completed');
    expect(ladderScore(end)).toBe(6);
    expect(currentQuestion(end)).toBeNull();
    expect(endingMiss(end)).toBeNull();
  });

  it('ends on the first miss and scores the rungs cleared', () => {
    let s = answerCorrectly(startLadder(TEST_QUESTIONS), 2);
    s = answer(s, 'no idea');
    expect(s.status).toBe('missed');
    expect(ladderScore(s)).toBe(2);
    expect(clearedRungs(s)).toEqual(['recall', 'second_order']);
    expect(endingMiss(s)?.miss_tag).toBe('unknown');
    const result: GradeResult = {
      grade: 'correct',
      reason: 'x',
      matched: [],
      confused_with_script_id: null,
    };
    expect(() => submitAnswer(s, { answer: 'late', elapsed_ms: 0, result })).toThrow(LadderError);
  });

  it('records a confused_with miss on recall', () => {
    const s = answer(startLadder(TEST_QUESTIONS), 'Quellan fever');
    expect(ladderScore(s)).toBe(0);
    expect(endingMiss(s)?.miss_tag).toBe('confused_with:quellan-fever');
  });

  it('records partial credit on a list question', () => {
    let s = answerCorrectly(startLadder(TEST_QUESTIONS), 1);
    s = answer(s, 'glimmer exposure');
    const last = endingMiss(s)!;
    expect(last.miss_tag).toBe('partial_list');
    expect(last.credit).toBeCloseTo(1 / 3);
  });

  it('tags a slow correct answer under a timed persona', () => {
    const s = answer(startLadder(TEST_QUESTIONS, 'surgeon'), 'Zorblax syndrome', 60_000);
    expect(endingMiss(s)?.miss_tag).toBe('slow');
  });

  it('rejects a ladder with two questions on one rung', () => {
    const second = { ...recall, id: 'zorblax-syndrome.recall.2' };
    expect(() => startLadder([recall, second])).toThrow(LadderError);
  });

  it('does not mutate the previous state', () => {
    const start = startLadder(TEST_QUESTIONS);
    answer(start, 'Zorblax syndrome');
    expect(start.attempts).toHaveLength(0);
    expect(start.index).toBe(0);
  });
});

describe('pickLadder', () => {
  const variant = (q: Question, n: number): Question => ({ ...q, id: q.id.replace(/\.1$/, `.${n}`) });
  const pool = TEST_QUESTIONS.flatMap((q) => [q, variant(q, 2), variant(q, 3)]);

  it('picks one question per rung, in rung order', () => {
    const picks = pickLadder(pool, { random: () => 0.5 });
    expect(picks.map((q) => q.rung)).toEqual([...RUNGS]);
    expect(picks.every((q) => q.id.endsWith('.2'))).toBe(true);
    expect(startLadder(picks).questions).toHaveLength(RUNGS.length);
  });

  it('follows the random source', () => {
    expect(pickLadder(pool, { random: () => 0 })[0]!.id).toBe('zorblax-syndrome.recall.1');
    expect(pickLadder(pool, { random: () => 0.99 })[0]!.id).toBe('zorblax-syndrome.recall.3');
    expect(pickLadder(pool, { random: () => 1 })[0]!.id).toBe('zorblax-syndrome.recall.3');
  });

  it("avoids last session's questions when the rung has another", () => {
    const last = pickLadder(pool, { random: () => 0 }).map((q) => q.id);
    for (let i = 0; i < 20; i++) {
      const picks = pickLadder(pool, { avoid: last, random: Math.random });
      expect(picks.some((q) => last.includes(q.id))).toBe(false);
    }
  });

  it('reuses a question when it is the only one on its rung', () => {
    const recallOnly = [recall];
    expect(pickLadder(recallOnly, { avoid: [recall.id] })).toEqual([recall]);
    // A one-question-per-rung script still gives a full ladder.
    expect(pickLadder(TEST_QUESTIONS, { avoid: TEST_QUESTIONS.map((q) => q.id) })).toHaveLength(6);
  });

  it('scores rungs, not questions', () => {
    const picks = pickLadder(pool, { random: () => 0 });
    expect(ladderScore(answerCorrectly(startLadder(picks), RUNGS.length))).toBe(6);
  });
});

describe('bestRung', () => {
  it('keeps the highest score', () => {
    expect(bestRung(null, 2)).toBe(2);
    expect(bestRung(4, 2)).toBe(4);
  });
});
