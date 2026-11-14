import { describe, expect, it } from 'vitest';
import { TEST_QUESTION_VARIANTS, TEST_QUESTIONS, TEST_SCRIPTS } from '../fixtures/index.ts';
import type { Question } from '../schemas/question.ts';
import type { Json } from './database.types.ts';
import {
  parseRows,
  questionFromRow,
  questionToRow,
  scriptFromRow,
  scriptToRow,
  type QuestionRow,
  type ScriptRow,
} from './rows.ts';
import { buildSeedSql, SeedError, validateContent } from './seed.ts';

const now = '2026-11-13T00:00:00.000Z';

function asScriptRow(script: (typeof TEST_SCRIPTS)[number]): ScriptRow {
  const row = scriptToRow(script);
  return {
    id: row.id,
    version: row.version ?? 1,
    status: row.status ?? 'draft',
    reviewed_by: row.reviewed_by ?? null,
    reviewed_at: row.reviewed_at ?? null,
    content: row.content as NonNullable<Json>,
    created_at: now,
    updated_at: now,
  };
}

function asQuestionRow(question: Question): QuestionRow {
  const row = questionToRow(question);
  return { ...row, content: row.content as NonNullable<Json>, created_at: now };
}

describe('script rows', () => {
  it('round-trip without losing anything', () => {
    for (const script of TEST_SCRIPTS) {
      expect(scriptFromRow(asScriptRow(script))).toEqual({
        ...script,
        reviewed_at: new Date(script.reviewed_at!).toISOString(),
      });
    }
  });

  it('keep review metadata out of content', () => {
    const { content } = scriptToRow(TEST_SCRIPTS[0]!);
    expect(Object.keys(content as object)).not.toEqual(
      expect.arrayContaining(['id', 'status', 'version', 'reviewed_by', 'reviewed_at']),
    );
  });

  it('accept Postgres timestamp formats', () => {
    const row = { ...asScriptRow(TEST_SCRIPTS[0]!), reviewed_at: '2026-11-13 08:30:00.123456+00' };
    expect(scriptFromRow(row).reviewed_at).toBe('2026-11-13T08:30:00.123Z');
  });

  it('let columns win over content', () => {
    const row = asScriptRow(TEST_SCRIPTS[0]!);
    const tampered = {
      ...row,
      content: { ...(row.content as object), status: 'draft' } as NonNullable<Json>,
    };
    expect(scriptFromRow(tampered).status).toBe('approved');
  });
});

describe('question rows', () => {
  it('round-trip both kinds', () => {
    for (const question of TEST_QUESTIONS) {
      expect(questionFromRow(asQuestionRow(question))).toEqual(question);
    }
  });
});

describe('parseRows', () => {
  it('skips invalid rows and reports why', () => {
    const good = asQuestionRow(TEST_QUESTIONS[0]!);
    const bad = { ...good, id: 'broken.1', content: { kind: 'single' } as NonNullable<Json> };
    const result = parseRows([good, bad], questionFromRow);
    expect(result.items.map((q) => q.id)).toEqual([good.id]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]!.id).toBe('broken.1');
  });
});

describe('seed', () => {
  it('validates the fixtures', () => {
    expect(
      validateContent(TEST_SCRIPTS, [...TEST_QUESTIONS, ...TEST_QUESTION_VARIANTS]),
    ).toEqual([]);
  });

  it('refuses untraceable questions and dangling links', () => {
    const invented: Question = {
      ...TEST_QUESTIONS[0]!,
      accepted_answers: [{ answer: 'Invented disease', synonyms: [] }],
    };
    expect(() => buildSeedSql(TEST_SCRIPTS, [invented], 'x')).toThrow(SeedError);
    expect(validateContent([TEST_SCRIPTS[0]!], [])).toEqual([
      'zorblax-syndrome: confused_with links to unknown script quellan-fever',
    ]);
  });

  it('escapes quotes and comments the header', () => {
    const script = { ...TEST_SCRIPTS[1]!, pearls: ["Quellan's pearl"], confused_with: [] };
    const sql = buildSeedSql([script], [], 'Line one\nLine two');
    expect(sql.startsWith('-- Line one\n-- Line two\n')).toBe(true);
    expect(sql).toContain("Quellan''s pearl");
    expect(sql).not.toContain('insert into public.questions');
  });
});
