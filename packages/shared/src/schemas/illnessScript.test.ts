import { describe, expect, it } from 'vitest';
import { TEST_SCRIPTS } from '../fixtures/index.ts';
import {
  IllnessScriptSchema,
  isPimpable,
  MAX_ANKI_CORE_NOTES,
  MAX_ANKI_NOTES_PER_RUNG,
} from './illnessScript.ts';

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
    expect(issues({ ...base(), anki_refs: [{ kind: 'note', id: 'abc' }] })).not.toEqual([]);
  });

  it('links notes only, not cards (card ids differ per student)', () => {
    expect(issues({ ...base(), anki_refs: [{ kind: 'card', id: '1' }] })).not.toEqual([]);
  });

  it('accepts an optional rung on a note and rejects unknown rungs', () => {
    const refs = (rung?: string) => ({ ...base(), anki_refs: [{ kind: 'note', id: '1', rung }] });
    expect(issues(refs('management'))).toEqual([]);
    expect(issues(refs())).toEqual([]);
    expect(issues(refs('anatomy'))).not.toEqual([]);
  });

  it('rejects the same note twice in a script', () => {
    const dup = [
      { kind: 'note', id: '7' },
      { kind: 'note', id: '7', rung: 'workup' },
    ];
    expect(issues({ ...base(), anki_refs: dup })).toEqual(['Duplicate Anki note 7']);
  });

  it('caps notes per rung and core notes', () => {
    const notes = (n: number, rung?: string) =>
      Array.from({ length: n }, (_, i) => ({ kind: 'note', id: String(100 + i), rung }));
    expect(issues({ ...base(), anki_refs: notes(MAX_ANKI_NOTES_PER_RUNG, 'management') })).toEqual(
      [],
    );
    expect(
      issues({ ...base(), anki_refs: notes(MAX_ANKI_NOTES_PER_RUNG + 1, 'management') }),
    ).toEqual([`More than ${MAX_ANKI_NOTES_PER_RUNG} Anki notes on the management rung`]);
    expect(issues({ ...base(), anki_refs: notes(MAX_ANKI_CORE_NOTES) })).toEqual([]);
    expect(issues({ ...base(), anki_refs: notes(MAX_ANKI_CORE_NOTES + 1) })).toEqual([
      `More than ${MAX_ANKI_CORE_NOTES} core Anki notes (no rung)`,
    ]);
  });

  it('checks comparison rows trace to a field and stay short', () => {
    const withRows = (compare: unknown) => ({
      ...base(),
      confused_with: [{ script_id: 'quellan-fever', how_to_tell_apart: 'x', compare }],
    });
    const row = { label: 'Nails', text: 'Blue nail beds', source_field: 'key_findings.exam[0]' };
    expect(issues(withRows([row]))).toEqual([]);
    expect(issues(withRows([{ ...row, source_field: 'key_findings.exam[9]' }]))).toEqual([
      'Field path "key_findings.exam[9]" does not exist in this script',
    ]);
    expect(issues(withRows([{ ...row, text: 'x'.repeat(37) }]))).not.toEqual([]);
    expect(issues(withRows([row, row, row, row]))).not.toEqual([]);
    expect(issues(withRows([]))).not.toEqual([]);
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
    expect(issues({ ...base(), rotation: ['wards'] })).not.toEqual([]);
    expect(issues({ ...base(), systems: ['heart'] })).not.toEqual([]);
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
