import { describe, expect, it } from 'vitest';
import { TEST_QUESTIONS, TEST_SCRIPTS } from '../fixtures/index.ts';
import type { Question } from '../schemas/question.ts';
import { buildGradingContext, sanitizeLlmGrade } from './llmGrade.ts';
import { confusablesFor, gradeLocally } from './localGrader.ts';

const zorblax = TEST_SCRIPTS[0]!;
const confusables = confusablesFor(zorblax, TEST_SCRIPTS);
const byId = (id: string): Question => TEST_QUESTIONS.find((q) => q.id === id)!;
const recall = byId('zorblax-syndrome.recall.1');
const list = byId('zorblax-syndrome.second-order.1');
const management = byId('zorblax-syndrome.management.1');

const sanitize = (
  question: Question,
  answer: string,
  matched_answers: string[],
  confused_with_script_id: string | null = null,
) =>
  sanitizeLlmGrade(
    { matched_answers, confused_with_script_id },
    question,
    confusables,
    gradeLocally(question, answer, confusables),
  );

describe('buildGradingContext', () => {
  it('includes only script text the question was written from', () => {
    const ctx = buildGradingContext(list, zorblax, confusables);
    expect(ctx.source_excerpts).toEqual(zorblax.epidemiology.risk_factors);
    expect(ctx.required_count).toBe(3);
    expect(ctx.kind).toBe('list');
  });

  it('attaches how-to-tell-apart notes to confusables', () => {
    const ctx = buildGradingContext(recall, zorblax, confusables);
    expect(ctx.confusables).toEqual([
      {
        script_id: 'quellan-fever',
        names: ['Quellan fever', 'QF'],
        how_to_tell_apart: 'Quellan fever causes green nail beds and a normal blorp.',
      },
    ]);
    expect(ctx.required_count).toBeNull();
  });
});

describe('sanitizeLlmGrade', () => {
  it('accepts a misspelling the model matched to a canonical answer', () => {
    const { result, discarded } = sanitize(management, 'zorbicilin', ['zorbicillin']);
    expect(result.grade).toBe('correct');
    expect(result.matched).toEqual(['zorbicillin']);
    expect(discarded).toEqual([]);
  });

  it('maps synonyms and case to the canonical answer', () => {
    const { result } = sanitize(recall, 'zbx', ['zbx']);
    expect(result.matched).toEqual(['Zorblax syndrome']);
  });

  it('drops matches that are not accepted answers', () => {
    const { result, discarded } = sanitize(management, 'penicillin', ['penicillin']);
    expect(result.grade).toBe('incorrect');
    expect(result.matched).toEqual([]);
    expect(discarded).toEqual(['matched: penicillin']);
  });

  it('ignores confused-with ids that are not linked to the script', () => {
    const { result, discarded } = sanitize(recall, 'flu', [], 'influenza');
    expect(result.confused_with_script_id).toBeNull();
    expect(discarded).toEqual(['confused_with: influenza']);
  });

  it('keeps a linked confused-with id when nothing correct was named', () => {
    const { result } = sanitize(recall, 'the one with green nails', [], 'quellan-fever');
    expect(result.grade).toBe('incorrect');
    expect(result.confused_with_script_id).toBe('quellan-fever');
  });

  it('drops confused-with when the answer was also correct', () => {
    const { result } = sanitize(
      recall,
      'zorblax, not quellan',
      ['Zorblax syndrome'],
      'quellan-fever',
    );
    expect(result.grade).toBe('correct');
    expect(result.confused_with_script_id).toBeNull();
  });

  it('recomputes list credit from matches rather than trusting the model', () => {
    const { result } = sanitize(list, 'glimmer, working nights', [
      'glimmer exposure',
      'night shift work',
    ]);
    expect(result.grade).toBe('partial');
    expect(result.reason).toBe('Named 2 of 3. Missed: low blorp diet, family history.');
  });

  it('never loses literal matches the local grader found', () => {
    const { result } = sanitize(list, 'glimmer, family history, nocturnal jobs', [
      'night shift work',
    ]);
    expect(result.grade).toBe('correct');
    expect(result.matched).toEqual(['glimmer exposure', 'night shift work', 'family history']);
  });

  it('counts each accepted answer once', () => {
    const { result } = sanitize(list, 'glimmer', [
      'glimmer exposure',
      'Glimmer exposure',
      'glimmer',
    ]);
    expect(result.matched).toEqual(['glimmer exposure']);
  });
});
