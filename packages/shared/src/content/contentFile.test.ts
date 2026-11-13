import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildSeedSql } from '../db/seed.ts';
import { TEST_SCRIPTS, testQuestionsFor } from '../fixtures/index.ts';
import {
  approvalHash,
  approve,
  canonicalJson,
  checkApprovals,
  checkContent,
  parseContentFile,
  renderReviewSheet,
  seedable,
  type ContentFile,
} from './contentFile.ts';

const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');
const NOW = new Date('2026-11-14T15:00:00Z');

/** The zorblax fixture as a draft content file on disk. */
function rawDraft(id = 'zorblax-syndrome') {
  const script = { ...TEST_SCRIPTS.find((s) => s.id === id)!, status: 'draft', reviewed_by: null, reviewed_at: null };
  const questions = testQuestionsFor(id).map((q) => {
    const copy: Record<string, unknown> = { ...q };
    delete copy.script_id;
    delete copy.script_version;
    return copy;
  });
  return { script, questions };
}

function draftFile(): ContentFile {
  const { file, problems } = parseContentFile(rawDraft(), 'zorblax-syndrome');
  expect(problems).toEqual([]);
  return file!;
}

describe('parseContentFile', () => {
  it('fills script id and version into questions', () => {
    const file = draftFile();
    expect(file.questions).toHaveLength(6);
    expect(file.questions.every((q) => q.script_id === 'zorblax-syndrome' && q.script_version === 1)).toBe(true);
  });

  it('requires the file name to match the script id', () => {
    expect(parseContentFile(rawDraft(), 'other').problems).toContain(
      'other: file name must match script id "zorblax-syndrome"',
    );
  });

  it('requires exactly one question per rung', () => {
    const raw = rawDraft();
    raw.questions = raw.questions.filter((q) => q.rung !== 'pearl');
    expect(parseContentFile(raw, 'zorblax-syndrome').problems).toContain(
      'zorblax-syndrome: needs exactly one pearl question (has 0)',
    );
  });

  it('reports schema problems with their path', () => {
    const raw = rawDraft();
    raw.questions[0] = { ...raw.questions[0], prompt: '' };
    const { problems } = parseContentFile(raw, 'zorblax-syndrome');
    expect(problems.some((p) => p.startsWith('zorblax-syndrome.questions[0].prompt'))).toBe(true);
  });

  it('rejects an approved script with no reviewer', () => {
    const raw = rawDraft();
    raw.script = { ...raw.script, status: 'approved' };
    expect(parseContentFile(raw, 'zorblax-syndrome').file).toBeNull();
  });
});

describe('canonicalJson', () => {
  it('ignores key order', () => {
    expect(canonicalJson({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonicalJson({ a: [{ c: 3, d: 2 }], b: 1 }));
  });
});

describe('approval', () => {
  it('records who approved which text, and the hash ignores review fields', () => {
    const draft = draftFile();
    const { file, approvals } = approve(draft, {}, ' Dr. J. Patel, PGY-3 ', NOW, sha256);
    expect(file.script).toMatchObject({
      status: 'approved',
      reviewed_by: 'Dr. J. Patel, PGY-3',
      reviewed_at: '2026-11-14T15:00:00.000Z',
    });
    expect(approvals['zorblax-syndrome']).toEqual({
      version: 1,
      hash: approvalHash(draft, sha256),
      reviewed_by: 'Dr. J. Patel, PGY-3',
      reviewed_at: '2026-11-14T15:00:00.000Z',
    });
    expect(checkApprovals([file], approvals, sha256)).toEqual([]);
  });

  it('fails the check when approved text is edited', () => {
    const { file, approvals } = approve(draftFile(), {}, 'Reviewer', NOW, sha256);
    const edited: ContentFile = {
      ...file,
      script: { ...file.script, pearls: ['A new, unreviewed pearl.'] },
    };
    expect(checkApprovals([edited], approvals, sha256)).toEqual([
      'zorblax-syndrome: edited after approval. Set status to "in_review", bump version and have it reviewed again.',
    ]);
  });

  it('fails when a script says approved without a recorded approval', () => {
    const { file } = approve(draftFile(), {}, 'Reviewer', NOW, sha256);
    expect(checkApprovals([file], {}, sha256)[0]).toMatch(/no approval is recorded/);
  });

  it('refuses a blank reviewer or a second approval', () => {
    expect(() => approve(draftFile(), {}, '  ', NOW, sha256)).toThrow(/Reviewer/);
    const once = approve(draftFile(), {}, 'Reviewer', NOW, sha256);
    expect(() => approve(once.file, once.approvals, 'Reviewer', NOW, sha256)).toThrow(/already approved/);
  });
});

describe('checkContent and seedable', () => {
  it('flags links to scripts that are not in the repo', () => {
    expect(checkContent([draftFile()], {}, sha256)).toContain(
      'zorblax-syndrome: confused_with links to unknown script quellan-fever',
    );
  });

  it('seeds only approved scripts, keeping links to scripts still in review', () => {
    const quellanRaw = rawDraft('quellan-fever');
    // quellan-fever has one question in the fixtures; seedable doesn't need a full ladder.
    const quellan = parseContentFile(quellanRaw, 'quellan-fever').file!;
    const approved = approve(draftFile(), {}, 'Reviewer', NOW, sha256).file;
    const { scripts, questions, linkTargets } = seedable([approved, quellan]);
    expect(scripts.map((s) => s.id)).toEqual(['zorblax-syndrome']);
    expect(scripts[0]!.confused_with.map((c) => c.script_id)).toEqual(['quellan-fever']);
    expect(questions.every((q) => q.script_id === 'zorblax-syndrome')).toBe(true);
    expect([...linkTargets].sort()).toEqual(['quellan-fever', 'zorblax-syndrome']);

    // The seed accepts a link to a script that exists but isn't approved yet...
    const sql = buildSeedSql(scripts, questions, 'test', linkTargets);
    expect(sql).toContain("'zorblax-syndrome'");
    expect(sql).not.toContain("'quellan-fever', 1, 'draft'");
    // ...but not to one that doesn't exist at all.
    expect(() => buildSeedSql(scripts, questions, 'test')).toThrow(/unknown script quellan-fever/);
  });
});

describe('renderReviewSheet', () => {
  it('shows every question with its answers, source text and the approve command', () => {
    const sheet = renderReviewSheet(draftFile(), new Map([['quellan-fever', 'Quellan fever']]));
    expect(sheet).toContain('# Zorblax syndrome');
    expect(sheet).toContain('Status: **draft**, version 1');
    expect(sheet).toContain('**Quellan fever**: Quellan fever causes green nail beds');
    expect(sheet).toContain('### 2. second order (list: name 3)');
    expect(sheet).toContain('| night shift work | night shift, shift work |');
    expect(sheet).toContain('`management.first_line`: zorbicillin');
    expect(sheet).toContain('pnpm content:approve zorblax-syndrome --by "Your name, role"');
  });
});
