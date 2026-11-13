import { describe, expect, it } from 'vitest';
import { AnswerTextSchema, MissTagSchema } from './attempt';

describe('MissTagSchema', () => {
  it.each(['unknown', 'slow', 'partial_list', 'confused_with:quellan-fever'])('accepts %s', (tag) =>
    expect(MissTagSchema.safeParse(tag).success).toBe(true),
  );

  it.each(['confused_with:', 'confused_with:Bad Id', 'wrong', 42])('rejects %j', (tag) =>
    expect(MissTagSchema.safeParse(tag).success).toBe(false),
  );
});

describe('AnswerTextSchema', () => {
  it('accepts clinical answers with numbers and eponyms', () => {
    for (const answer of ["Murphy's sign", 'BP 120/80, K 6.5', 'platelets 150,000']) {
      expect(AnswerTextSchema.safeParse(answer).success).toBe(true);
    }
  });

  it('blocks answers containing identifiers', () => {
    expect(AnswerTextSchema.safeParse('my patient DOB 03/14/1962').success).toBe(false);
    expect(AnswerTextSchema.safeParse('MRN 12345678').success).toBe(false);
  });

  it('caps length', () => {
    expect(AnswerTextSchema.safeParse('a'.repeat(501)).success).toBe(false);
  });
});
