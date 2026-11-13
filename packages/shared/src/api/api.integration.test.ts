/**
 * Runs the API client against the local Supabase stack with the seeded
 * fictional fixtures. Requires `pnpm db:start` (and `pnpm db:reset` for a
 * clean seed). Each test signs in as a fresh anonymous student.
 */
import { createClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, inject, it } from 'vitest';
import type { Database } from '../db/database.types.ts';
import { gradeLocally } from '../grading/localGrader.ts';
import { currentQuestion, startLadder, submitAnswer, type LadderState } from '../ladder/engine.ts';
import {
  finishSession,
  getLadderContent,
  listPimpableScripts,
  recordAttempt,
  startSession,
  type LadderContent,
  type RoundsClient,
} from './index.ts';

async function newStudent(): Promise<RoundsClient> {
  const client = createClient<Database>(inject('supabaseUrl'), inject('supabaseKey'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return client;
}

const ANSWERS = ['Zorblax syndrome', 'glimmer, night shift, family hx', 'no idea'];

/** Plays the fixture ladder: two rungs right, then a miss. Records every attempt. */
async function playToMiss(client: RoundsClient, content: LadderContent) {
  const sessionId = await startSession(client, content.script, 'teacher');
  let state: LadderState = startLadder(content.questions);
  for (const answer of ANSWERS) {
    const question = currentQuestion(state);
    if (!question) break;
    state = submitAnswer(state, {
      answer,
      elapsed_ms: 500,
      result: gradeLocally(question, answer, content.confusables),
    });
    await recordAttempt(client, sessionId, state.attempts.at(-1)!);
  }
  return { sessionId, state, best: await finishSession(client, sessionId, state) };
}

describe('Rounds API against local Supabase', () => {
  let content: LadderContent;

  beforeAll(async () => {
    const loaded = await getLadderContent(await newStudent(), 'zorblax-syndrome');
    if (!loaded) throw new Error('Seed missing: run `pnpm content:seed && pnpm db:reset`');
    content = loaded;
  });

  it('lists approved scripts that have questions', async () => {
    const scripts = await listPimpableScripts(await newStudent());
    expect(scripts.map((s) => s.script.id)).toEqual(['zorblax-syndrome']);
    expect(scripts[0]!.questionCount).toBe(6);
    expect(scripts[0]!.bestRung).toBeNull();
  });

  it('loads a ladder with traced questions and confusables', () => {
    expect(content.questions).toHaveLength(6);
    expect(content.confusables).toEqual([
      { script_id: 'quellan-fever', names: ['Quellan fever', 'QF'] },
    ]);
  });

  it('returns null for unknown scripts', async () => {
    expect(await getLadderContent(await newStudent(), 'no-such-script')).toBeNull();
  });

  it('saves a ladder run and the best rung', async () => {
    const student = await newStudent();
    const { sessionId, state, best } = await playToMiss(student, content);
    expect(state.status).toBe('missed');
    expect(best).toBe(2);

    const { data: attempts } = await student
      .from('attempts')
      .select('passed, miss_tag')
      .eq('session_id', sessionId)
      .order('created_at');
    expect(attempts).toEqual([
      { passed: true, miss_tag: null },
      { passed: true, miss_tag: null },
      { passed: false, miss_tag: 'unknown' },
    ]);

    const [summary] = await listPimpableScripts(student);
    expect(summary!.bestRung).toBe(2);
  });

  it('keeps each student to their own data', async () => {
    const a = await newStudent();
    const { sessionId } = await playToMiss(a, content);

    const b = await newStudent();
    const { data: sessions } = await b.from('ladder_sessions').select('id');
    const { data: attempts } = await b.from('attempts').select('id');
    expect(sessions).toEqual([]);
    expect(attempts).toEqual([]);
    expect((await listPimpableScripts(b))[0]!.bestRung).toBeNull();

    const finishAsB = await b.rpc('finish_ladder_session', {
      p_session_id: sessionId,
      p_status: 'missed',
      p_score: 0,
    });
    expect(finishAsB.error?.code).toBe('P0002');
  });

  it('refuses attempts that look like patient details', async () => {
    const student = await newStudent();
    const sessionId = await startSession(student, content.script, 'teacher');
    await expect(
      recordAttempt(student, sessionId, {
        question_id: 'zorblax-syndrome.recall.1',
        answer: 'MRN 12345678',
        elapsed_ms: 1,
        grade: 'incorrect',
        reason: 'x',
        credit: 0,
        passed: false,
        miss_tag: 'unknown',
        grader: 'local',
        grader_version: null,
      }),
    ).rejects.toThrow(/patient details/);
  });
});
