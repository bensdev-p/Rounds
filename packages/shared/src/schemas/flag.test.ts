import { describe, expect, it } from 'vitest';
import { FlagNoteSchema, NewFlagSchema } from './flag.ts';

describe('FlagNoteSchema', () => {
  it('accepts a note about the content, eponyms included', () => {
    expect(FlagNoteSchema.safeParse("Murphy's sign should count here").success).toBe(true);
  });

  it('blocks patient details, names included', () => {
    expect(FlagNoteSchema.safeParse('Mr. Alvarez had this exact picture').success).toBe(false);
    expect(FlagNoteSchema.safeParse('MRN 12345678').success).toBe(false);
  });

  it('limits length and trims', () => {
    expect(FlagNoteSchema.safeParse('x'.repeat(281)).success).toBe(false);
    expect(FlagNoteSchema.parse('  fine  ')).toBe('fine');
    expect(FlagNoteSchema.safeParse('   ').success).toBe(false);
  });
});

describe('NewFlagSchema', () => {
  it('allows flagging a whole script with no note', () => {
    expect(
      NewFlagSchema.safeParse({
        script_id: 'zorblax-syndrome',
        question_id: null,
        script_version: 1,
        reason: 'script_error',
        note: null,
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown reason', () => {
    expect(
      NewFlagSchema.safeParse({
        script_id: 'zorblax-syndrome',
        question_id: null,
        script_version: 1,
        reason: 'bored',
        note: null,
      }).success,
    ).toBe(false);
  });
});
