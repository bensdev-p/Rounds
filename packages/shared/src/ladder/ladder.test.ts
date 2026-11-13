import { describe, expect, it } from 'vitest';
import { TEST_QUESTIONS, TEST_SCRIPTS } from '../fixtures';
import { confusablesFor, gradeLocally } from '../grading/localGrader';
import type { GradeResult } from '../schemas/attempt';
import { RUNGS, type ListQuestion, type Question } from '../schemas/question';
import {
  bestRung,
  clearedRungs,
  currentQuestion,
  endingMiss,
  ladderScore,
  LadderError,
  startLadder,
  submitAnswer,
  type LadderState,
} from './engine';
import { classifyMiss } from './missTags';
import { PERSONAS, type PersonaId } from './personas';

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

  it('needs every question on a rung to clear it', () => {
    const second = { ...recall, id: 'zorblax-syndrome.recall.2' };
    let s = startLadder([recall, second]);
    s = answer(s, 'Zorblax syndrome');
    expect(ladderScore(s)).toBe(0);
    s = answer(s, 'Zorblax syndrome');
    expect(ladderScore(s)).toBe(1);
  });

  it('does not mutate the previous state', () => {
    const start = startLadder(TEST_QUESTIONS);
    answer(start, 'Zorblax syndrome');
    expect(start.attempts).toHaveLength(0);
    expect(start.index).toBe(0);
  });
});

describe('bestRung', () => {
  it('keeps the highest score', () => {
    expect(bestRung(null, 2)).toBe(2);
    expect(bestRung(4, 2)).toBe(4);
  });
});
