import { describe, expect, it } from 'vitest';
import {
  isFixtureScript,
  TEST_QUESTION_VARIANTS,
  TEST_QUESTIONS,
  TEST_SCRIPTS,
} from '../fixtures/index.ts';
import type { IllnessScript } from '../schemas/illnessScript.ts';
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
import { buildContentSql, buildSeedSql, SeedError, validateContent } from './seed.ts';

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

describe('isFixtureScript', () => {
  it('knows the fictional fixtures and nothing else', () => {
    expect(TEST_SCRIPTS.every((s) => isFixtureScript(s.id))).toBe(true);
    expect(isFixtureScript('acute-pancreatitis')).toBe(false);
  });
});

describe('seed', () => {
  it('validates the fixtures', () => {
    expect(validateContent(TEST_SCRIPTS, [...TEST_QUESTIONS, ...TEST_QUESTION_VARIANTS])).toEqual(
      [],
    );
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

  it('needs the same comparison labels on both sides of a pair', () => {
    const [zorblax, quellan] = TEST_SCRIPTS as [IllnessScript, IllnessScript];
    const link = quellan.confused_with[0]!;
    const relabelled: IllnessScript = {
      ...quellan,
      confused_with: [
        { ...link, compare: link.compare!.map((r, i) => (i === 0 ? { ...r, label: 'Nail' } : r)) },
      ],
    };
    expect(validateContent([zorblax, relabelled], [])).toEqual([
      "zorblax-syndrome: compare rows with quellan-fever need the same labels on quellan-fever's link back (Nails | Blorp vs Nail | Blorp)",
      "quellan-fever: compare rows with zorblax-syndrome need the same labels on zorblax-syndrome's link back (Nail | Blorp vs Nails | Blorp)",
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

describe('content push', () => {
  // A real-looking script: the fixtures are refused, so rename one.
  const fixture = TEST_SCRIPTS[0]!;
  const script: IllnessScript = {
    ...fixture,
    id: 'real-script',
    status: 'in_review',
    reviewed_by: null,
    reviewed_at: null,
    pearls: [...fixture.pearls, "Real's pearl"],
  };
  // Its mix-up partner is another script in the repo, not pushed in these tests.
  const links = new Set([script.id, ...fixture.confused_with.map((l) => l.script_id)]);
  const push = (preview: boolean, s: IllnessScript = script, qs: readonly Question[] = questions) =>
    buildContentSql([s], qs, 'Push', { preview }, links);
  const questions = TEST_QUESTIONS.filter((q) => q.script_id === fixture.id).map((q) => ({
    ...q,
    id: `real-${q.id}`,
    script_id: script.id,
  }));

  it('upserts scripts and questions in one transaction', () => {
    const sql = push(false);
    expect(sql.startsWith('-- Push\n')).toBe(true);
    expect(sql).toContain('do $push$\nbegin\n');
    expect(sql.trimEnd().endsWith('end $push$;')).toBe(true);
    expect(sql).toContain('on conflict (id) do update set\n  version = excluded.version');
    expect(sql).toContain('rung = excluded.rung, content = excluded.content;');
    expect(sql).toContain("Real''s pearl");
    expect(sql.indexOf('public.illness_scripts (id')).toBeLessThan(
      sql.indexOf('public.questions (id'),
    );
  });

  it('retires scripts the repo no longer has', () => {
    const sql = push(false);
    expect(sql).toContain(
      "update public.illness_scripts set status = 'retired'\n  where status <> 'retired' and id not in ('real-script');",
    );
  });

  it('sets the preview switch either way', () => {
    expect(push(true)).toContain("values ('show_in_review', true)");
    expect(push(false)).toContain("values ('show_in_review', false)");
  });

  it('refuses the test fixtures', () => {
    expect(() => buildContentSql([fixture], [], 'Push', { preview: false })).toThrow(
      /Test fixtures never go to a hosted project: zorblax-syndrome/,
    );
  });

  it('refuses drafts', () => {
    expect(() => push(false, { ...script, status: 'draft' }, [])).toThrow(/real-script \(draft\)/);
  });

  it('refuses untraceable questions', () => {
    const bad = { ...questions[0]!, script_id: 'missing' };
    expect(() => push(false, script, [bad])).toThrow(SeedError);
  });
});
