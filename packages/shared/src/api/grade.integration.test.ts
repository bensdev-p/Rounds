/**
 * The `grade-answer` Edge Function against the local stack, with the fake
 * model (spends nothing). Requires `pnpm db:start` and `pnpm functions:serve:fake`.
 */
import { createClient } from '@supabase/supabase-js';
import { describe, expect, inject, it } from 'vitest';
import type { Database } from '../db/database.types.ts';
import { GradeRejectedError, gradeAnswer, RoundsApiError, type RoundsClient } from './index.ts';

async function newStudent(): Promise<RoundsClient> {
  const client = createClient<Database>(inject('supabaseUrl'), inject('supabaseKey'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return client;
}

const RECALL = 'zorblax-syndrome.recall.1';
const LIST = 'zorblax-syndrome.second-order.1';
const MANAGEMENT = 'zorblax-syndrome.management.1';

describe('grade-answer function (fake model)', () => {
  it('grades exact matches locally without calling the model', async () => {
    const response = await gradeAnswer(await newStudent(), RECALL, 'zorblax');
    expect(response).toMatchObject({ grader: 'local', grader_version: null });
    expect(response.result.grade).toBe('correct');
  });

  it('asks the model when the local matcher misses, e.g. a misspelling', async () => {
    const response = await gradeAnswer(await newStudent(), MANAGEMENT, 'zorbicilin');
    expect(response.grader).toBe('llm');
    expect(response.grader_version).toBe('grade-answer/v1@fake');
    expect(response.result).toMatchObject({ grade: 'correct', matched: ['zorbicillin'] });
  });

  it('scores list answers with shared credit rules', async () => {
    const response = await gradeAnswer(await newStudent(), LIST, 'glimer, nigt shift');
    expect(response.result.grade).toBe('partial');
    expect(response.result.reason).toBe('Named 2 of 3. Missed: low blorp diet, family history.');
  });

  it('tags a mix-up with a confusable script', async () => {
    const response = await gradeAnswer(await newStudent(), RECALL, 'quelan fever');
    expect(response.result).toMatchObject({
      grade: 'incorrect',
      confused_with_script_id: 'quellan-fever',
    });
  });

  it('throws away model output that is not in the script', async () => {
    const response = await gradeAnswer(await newStudent(), MANAGEMENT, 'fake-invent');
    expect(response.grader).toBe('llm');
    expect(response.result).toMatchObject({
      grade: 'incorrect',
      matched: [],
      confused_with_script_id: null,
    });
  });

  it.each(['fake-timeout', 'fake-refusal'])(
    'falls back to the local grade on %s',
    async (answer) => {
      const response = await gradeAnswer(await newStudent(), MANAGEMENT, answer);
      expect(response).toMatchObject({ grader: 'local', grader_version: null });
      expect(response.result.grade).toBe('incorrect');
    },
  );

  it('refuses patient details on the server too', async () => {
    const student = await newStudent();
    // Bypass the client-side check to prove the server enforces it.
    const { error } = await student.functions.invoke('grade-answer', {
      body: { question_id: RECALL, answer: 'MRN 12345678' },
    });
    const response: unknown = (error as { context?: unknown } | null)?.context;
    expect(response instanceof Response && response.status).toBe(422);
    await expect(gradeAnswer(student, RECALL, 'MRN 12345678')).rejects.toBeInstanceOf(
      GradeRejectedError,
    );
  });

  it('returns not found for questions the student cannot see', async () => {
    const error = await gradeAnswer(await newStudent(), 'no-such.recall.1', 'x').catch((e) => e);
    expect(error).toBeInstanceOf(RoundsApiError);
    expect(error).not.toBeInstanceOf(GradeRejectedError);
  });

  it('requires a signed-in student', async () => {
    const anon = createClient<Database>(inject('supabaseUrl'), inject('supabaseKey'), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await expect(gradeAnswer(anon, RECALL, 'zorblax')).rejects.toBeInstanceOf(RoundsApiError);
  });
});
