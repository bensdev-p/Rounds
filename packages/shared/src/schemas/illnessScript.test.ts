import { describe, expect, it } from 'vitest';
import { TEST_SCRIPTS } from '../fixtures/index.ts';
import { IllnessScriptSchema, isPimpable } from './illnessScript.ts';

const base = (): Record<string, unknown> => structuredClone(TEST_SCRIPTS[0]!);

function issues(raw: unknown): string[] {
  const result = IllnessScriptSchema.safeParse(raw);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe('IllnessScriptSchema', () => {
  it('accepts the fixture scripts', () => {
    for (const script of TEST_SCRIPTS) expect(issues(script)).toEqual([]);
  });

  it('requires reviewer fields on approved scripts', () => {
    expect(issues({ ...base(), reviewed_by: null })).toContain(
      'Approved scripts must record reviewed_by and reviewed_at',
    );
    expect(issues({ ...base(), reviewed_at: null })).toHaveLength(1);
  });

  it('allows drafts without a reviewer', () => {
    expect(issues({ ...base(), status: 'draft', reviewed_by: null, reviewed_at: null })).toEqual(
      [],
    );
  });

  it('rejects unknown fields, so card text cannot be smuggled in', () => {
    const withText = { ...base(), anki_refs: [{ kind: 'note', id: '1', text: 'card front' }] };
    expect(issues(withText)).not.toEqual([]);
    expect(issues({ ...base(), anki_card_text: 'x' })).not.toEqual([]);
  });

  it('rejects non-numeric Anki ids', () => {
    expect(issues({ ...base(), anki_refs: [{ kind: 'card', id: 'abc' }] })).not.toEqual([]);
  });

  it('rejects self and duplicate confused_with links', () => {
    const self = { script_id: 'zorblax-syndrome', how_to_tell_apart: 'x' };
    expect(issues({ ...base(), confused_with: [self] })).toContain(
      'A script cannot be confused with itself',
    );
    const other = { script_id: 'quellan-fever', how_to_tell_apart: 'x' };
    expect(issues({ ...base(), confused_with: [other, other] })).toContain(
      'Duplicate confused_with link to quellan-fever',
    );
  });

  it('rejects difficulty tiers that point at missing facts', () => {
    const tiers = { 'MS1-2': ['pearls[9]'], MS3: [], MS4: [] };
    expect(issues({ ...base(), difficulty_tiers: tiers })[0]).toMatch(/does not exist/);
  });

  it('rejects bad ids, statuses and rotations', () => {
    expect(issues({ ...base(), id: 'Zorblax Syndrome' })).not.toEqual([]);
    expect(issues({ ...base(), status: 'published' })).not.toEqual([]);
    expect(issues({ ...base(), rotation: [] })).not.toEqual([]);
  });
});

describe('isPimpable', () => {
  it('only allows approved scripts', () => {
    expect(isPimpable({ status: 'approved' })).toBe(true);
    for (const status of ['draft', 'in_review', 'retired'] as const) {
      expect(isPimpable({ status })).toBe(false);
    }
  });
});
