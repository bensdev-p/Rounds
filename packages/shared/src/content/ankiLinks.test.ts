import { describe, expect, it } from 'vitest';
import { TEST_SCRIPTS, testQuestionsFor } from '../fixtures/index.ts';
import { AnkiLinksFileSchema, applyAnkiLinks, sortAnkiRefs } from './ankiLinks.ts';
import type { ContentFile } from './contentFile.ts';

const files = (): ContentFile[] =>
  TEST_SCRIPTS.map((script) => ({ script, questions: testQuestionsFor(script.id) }));

const linksFile = (scripts: Record<string, unknown>) =>
  AnkiLinksFileSchema.parse({ format: 'rounds-anki-links', version: 1, scripts });

describe('AnkiLinksFileSchema', () => {
  it('accepts note ids with an optional rung', () => {
    expect(() =>
      linksFile({ 'quellan-fever': [{ kind: 'note', id: '5', rung: 'workup' }] }),
    ).not.toThrow();
  });

  it('refuses anything beyond ids and rungs (no card text, no tag names)', () => {
    const parse = (ref: unknown) =>
      AnkiLinksFileSchema.safeParse({
        format: 'rounds-anki-links',
        version: 1,
        scripts: { 'quellan-fever': [ref] },
      }).success;
    expect(parse({ kind: 'note', id: '5' })).toBe(true);
    expect(parse({ kind: 'note', id: '5', text: 'front' })).toBe(false);
    expect(parse({ kind: 'note', id: '5', tag: '#AK_Step2_v12::x' })).toBe(false);
    expect(parse({ kind: 'card', id: '5' })).toBe(false);
    expect(
      AnkiLinksFileSchema.safeParse({
        format: 'rounds-anki-links',
        version: 1,
        scripts: {},
        tags: ['x'],
      }).success,
    ).toBe(false);
  });
});

describe('sortAnkiRefs', () => {
  it('puts core notes first, then rungs up the ladder, ids numerically', () => {
    const sorted = sortAnkiRefs([
      { kind: 'note', id: '30', rung: 'management' },
      { kind: 'note', id: '100' },
      { kind: 'note', id: '9', rung: 'recall' },
      { kind: 'note', id: '20' },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(['20', '100', '9', '30']);
  });
});

describe('applyAnkiLinks', () => {
  it('replaces links on named scripts and leaves the rest alone', () => {
    const result = applyAnkiLinks(
      files(),
      linksFile({
        'quellan-fever': [
          { kind: 'note', id: '8', rung: 'management' },
          { kind: 'note', id: '7' },
        ],
      }),
    );
    expect(result.problems).toEqual([]);
    expect(result.changed).toHaveLength(1);
    expect(result.changed[0]!.script.anki_refs).toEqual([
      { kind: 'note', id: '7' },
      { kind: 'note', id: '8', rung: 'management' },
    ]);
    expect(result.summary).toEqual([
      { scriptId: 'quellan-fever', before: 0, after: 2, changed: true },
    ]);
  });

  it('reports a script whose links are unchanged without rewriting it', () => {
    const zorblax = TEST_SCRIPTS[0]!;
    const result = applyAnkiLinks(files(), linksFile({ [zorblax.id]: zorblax.anki_refs }));
    expect(result.changed).toEqual([]);
    expect(result.summary[0]!.changed).toBe(false);
  });

  it('refuses unknown scripts, duplicates and too many notes on a rung', () => {
    const result = applyAnkiLinks(
      files(),
      linksFile({
        'no-such-script': [],
        'quellan-fever': [
          { kind: 'note', id: '1', rung: 'workup' },
          { kind: 'note', id: '2', rung: 'workup' },
          { kind: 'note', id: '3', rung: 'workup' },
          { kind: 'note', id: '4', rung: 'workup' },
        ],
        'zorblax-syndrome': [
          { kind: 'note', id: '1' },
          { kind: 'note', id: '1', rung: 'pearl' },
        ],
      }),
    );
    expect(result.problems).toEqual([
      'no-such-script: no script with this id in content/scripts',
      'quellan-fever: More than 3 Anki notes on the workup rung',
      'zorblax-syndrome: Duplicate Anki note 1',
    ]);
    expect(result.changed).toEqual([]);
  });
});
