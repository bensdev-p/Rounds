import { describe, expect, it } from 'vitest';
import { collectStrings, FieldPathSchema, resolveFieldPath } from './fieldPath.ts';

const doc = {
  name: 'X',
  key_findings: { labs: ['a', 'b'], exam: [] },
  confused_with: [{ script_id: 'y', how_to_tell_apart: 'note' }],
};

describe('FieldPathSchema', () => {
  it.each([
    'name',
    'key_findings.labs',
    'key_findings.labs[1]',
    'confused_with[0].how_to_tell_apart',
  ])('accepts %s', (path) => expect(FieldPathSchema.safeParse(path).success).toBe(true));

  it.each(['', 'Name', 'labs[]', 'a..b', 'a.[0]', 'a b'])('rejects %j', (path) =>
    expect(FieldPathSchema.safeParse(path).success).toBe(false),
  );
});

describe('resolveFieldPath', () => {
  it('resolves nested keys and indexes', () => {
    expect(resolveFieldPath(doc, 'key_findings.labs[1]')).toBe('b');
    expect(resolveFieldPath(doc, 'confused_with[0].how_to_tell_apart')).toBe('note');
  });

  it('returns undefined for missing keys, bad indexes and inherited props', () => {
    expect(resolveFieldPath(doc, 'key_findings.imaging')).toBeUndefined();
    expect(resolveFieldPath(doc, 'key_findings.labs[5]')).toBeUndefined();
    expect(resolveFieldPath(doc, 'name[0]')).toBeUndefined();
    expect(resolveFieldPath(doc, 'constructor')).toBeUndefined();
  });
});

describe('collectStrings', () => {
  it('flattens nested values', () => {
    expect(collectStrings(doc.confused_with)).toEqual(['y', 'note']);
    expect(collectStrings(42)).toEqual([]);
  });
});
