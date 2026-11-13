import { describe, expect, it } from 'vitest';
import { TEST_QUESTIONS, TEST_SCRIPTS } from '../fixtures';
import { QuestionSchema, traceQuestionToScript, type Question } from './question';

const script = TEST_SCRIPTS[0]!;
const recall = TEST_QUESTIONS[0]!;
const list = TEST_QUESTIONS.find((q) => q.kind === 'list')!;

describe('QuestionSchema', () => {
  it('requires at least one source field and accepted answer', () => {
    expect(QuestionSchema.safeParse({ ...recall, source_fields: [] }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...recall, accepted_answers: [] }).success).toBe(false);
  });

  it('rejects list questions asking for more items than exist', () => {
    expect(QuestionSchema.safeParse({ ...list, required_count: 99 }).success).toBe(false);
  });

  it('rejects unknown rungs and kinds', () => {
    expect(QuestionSchema.safeParse({ ...recall, rung: 'trivia' }).success).toBe(false);
    expect(QuestionSchema.safeParse({ ...recall, kind: 'essay' }).success).toBe(false);
  });
});

describe('traceQuestionToScript', () => {
  it('passes every fixture question', () => {
    for (const q of TEST_QUESTIONS) {
      const owner = TEST_SCRIPTS.find((s) => s.id === q.script_id)!;
      expect(traceQuestionToScript(q, owner)).toEqual([]);
    }
  });

  it('flags missing source fields', () => {
    const q: Question = { ...recall, source_fields: ['pearls[7]'] };
    expect(traceQuestionToScript(q, script).map((i) => i.path)).toContain('source_fields[0]');
  });

  it('flags accepted answers that are not in the script (no invented facts)', () => {
    const q: Question = {
      ...recall,
      accepted_answers: [{ answer: 'Invented disease', synonyms: [] }],
    };
    expect(traceQuestionToScript(q, script)).toEqual([
      {
        path: 'accepted_answers[0]',
        message: '"Invented disease" does not appear in any source field',
      },
    ]);
  });

  it('flags a question reviewed against another script or version', () => {
    const q: Question = { ...recall, script_id: 'quellan-fever', script_version: 2 };
    const paths = traceQuestionToScript(q, script).map((i) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['script_id', 'script_version']));
  });
});
