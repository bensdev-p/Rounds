/**
 * Rounds API client. Thin functions over a Supabase client; RLS decides what
 * each call can see. Everything read is validated with the shared schemas, and
 * everything written is validated before it leaves the client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../db/database.types.ts';
import { parseRows, questionFromRow, scriptFromRow, type ParseResult } from '../db/rows.ts';
import type { Confusable } from '../grading/localGrader.ts';
import { ladderScore, type LadderState } from '../ladder/engine.ts';
import type { PersonaId } from '../ladder/personas.ts';
import {
  AnswerTextSchema,
  AttemptSchema,
  GradeResponseSchema,
  type Attempt,
  type GradeResponse,
} from '../schemas/attempt.ts';
import { ScriptIdSchema, type IllnessScript } from '../schemas/illnessScript.ts';
import type { SessionRecord } from '../progress/progression.ts';
import { NewFlagSchema, type NewFlag } from '../schemas/flag.ts';
import { traceQuestionToScript, type Question } from '../schemas/question.ts';

export type RoundsClient = SupabaseClient<Database>;

export class RoundsApiError extends Error {
  override name = 'RoundsApiError';
}

/** The answer was refused (it looks like patient details). Do not retry or grade it elsewhere. */
export class GradeRejectedError extends RoundsApiError {
  override name = 'GradeRejectedError';
}

/** Called with rows that failed validation and were skipped. Defaults to console.warn. */
export type RejectHandler = (table: string, rejected: ParseResult<unknown>['rejected']) => void;

const warnRejected: RejectHandler = (table, rejected) => {
  if (rejected.length > 0) console.warn(`[rounds] skipped invalid ${table} rows`, rejected);
};

function unwrap<T>(
  result: { data: T | null; error: { message: string } | null },
  what: string,
): NonNullable<T> {
  if (result.error) throw new RoundsApiError(`${what}: ${result.error.message}`);
  if (result.data === null || result.data === undefined) {
    throw new RoundsApiError(`${what}: no data`);
  }
  return result.data;
}

export interface ScriptSummary {
  script: IllnessScript;
  questionCount: number;
  /** null until the student has finished a ladder on this script. */
  bestRung: number | null;
}

/** Visible scripts with at least one question, and the student's best rung on each. */
export async function listPimpableScripts(
  client: RoundsClient,
  onReject: RejectHandler = warnRejected,
): Promise<ScriptSummary[]> {
  const [scripts, questions, progress] = await Promise.all([
    // RLS decides what's visible: approved, plus in-review when previewing.
    client.from('illness_scripts').select('*').in('status', ['approved', 'in_review']).order('id'),
    client.from('questions').select('script_id'),
    client.from('script_progress').select('script_id, best_rung'),
  ]);

  const parsed = parseRows(unwrap(scripts, 'Loading scripts'), scriptFromRow);
  onReject('illness_scripts', parsed.rejected);

  const counts = new Map<string, number>();
  for (const q of unwrap(questions, 'Loading questions')) {
    counts.set(q.script_id, (counts.get(q.script_id) ?? 0) + 1);
  }
  const best = new Map(unwrap(progress, 'Loading progress').map((p) => [p.script_id, p.best_rung]));

  return parsed.items
    .map((script) => ({
      script,
      questionCount: counts.get(script.id) ?? 0,
      bestRung: best.get(script.id) ?? null,
    }))
    .filter((s) => s.questionCount > 0);
}

export interface LadderContent {
  script: IllnessScript;
  /** Only questions that trace to the script (domain rule 1). */
  questions: Question[];
  confusables: Confusable[];
}

/** Everything needed to run a ladder on one script, or null if it isn't available. */
export async function getLadderContent(
  client: RoundsClient,
  scriptId: string,
  onReject: RejectHandler = warnRejected,
): Promise<LadderContent | null> {
  const [scriptResult, questionResult] = await Promise.all([
    client.from('illness_scripts').select('*').eq('id', scriptId).maybeSingle(),
    client.from('questions').select('*').eq('script_id', scriptId).order('id'),
  ]);
  if (scriptResult.error) {
    throw new RoundsApiError(`Loading script: ${scriptResult.error.message}`);
  }
  if (!scriptResult.data) return null;

  const scriptParse = parseRows([scriptResult.data], scriptFromRow);
  onReject('illness_scripts', scriptParse.rejected);
  const script = scriptParse.items[0];
  if (!script) return null;

  const questionParse = parseRows(unwrap(questionResult, 'Loading questions'), questionFromRow);
  const untraced: ParseResult<unknown>['rejected'] = [];
  const questions = questionParse.items.filter((q) => {
    const issues = traceQuestionToScript(q, script);
    if (issues.length > 0) {
      untraced.push({ id: q.id, error: issues.map((i) => `${i.path}: ${i.message}`).join('; ') });
    }
    return issues.length === 0;
  });
  onReject('questions', [...questionParse.rejected, ...untraced]);

  const confusedIds = script.confused_with.map((c) => c.script_id);
  let confusables: Confusable[] = [];
  if (confusedIds.length > 0) {
    // Only approved scripts are visible, so drafts never show up as confusables.
    const others = unwrap(
      await client.from('illness_scripts').select('*').in('id', confusedIds),
      'Loading related scripts',
    );
    const otherParse = parseRows(others, scriptFromRow);
    onReject('illness_scripts', otherParse.rejected);
    confusables = otherParse.items.map((s) => ({ script_id: s.id, names: [s.name, ...s.aliases] }));
  }

  return { script, questions, confusables };
}

/** Starts a ladder session for the signed-in student. Returns the session id. */
export async function startSession(
  client: RoundsClient,
  script: Pick<IllnessScript, 'id' | 'version'>,
  persona: PersonaId,
): Promise<string> {
  const { data, error } = await client
    .from('ladder_sessions')
    .insert({ script_id: script.id, script_version: script.version, persona })
    .select('id')
    .single();
  if (error) throw new RoundsApiError(`Starting session: ${error.message}`);
  return data.id;
}

/** Saves one attempt. Validated first, including the patient-detail check. */
export async function recordAttempt(
  client: RoundsClient,
  sessionId: string,
  attempt: Attempt,
): Promise<void> {
  const valid = AttemptSchema.parse(attempt);
  const { error } = await client.from('attempts').insert({ session_id: sessionId, ...valid });
  if (error) throw new RoundsApiError(`Saving attempt: ${error.message}`);
}

/** Closes the session and returns the student's best rung on the script. */
export async function finishSession(
  client: RoundsClient,
  sessionId: string,
  state: LadderState,
): Promise<number> {
  if (state.status === 'in_progress') {
    throw new RoundsApiError('Cannot finish a ladder that is still in progress');
  }
  const progress = unwrap(
    await client.rpc('finish_ladder_session', {
      p_session_id: sessionId,
      p_status: state.status,
      p_score: ladderScore(state),
    }),
    'Finishing session',
  );
  return progress.best_rung;
}

/**
 * Records a "This is wrong" flag. Validated first, including the
 * patient-detail check on the note, so a bad note never leaves the device.
 */
export async function flagContent(client: RoundsClient, flag: NewFlag): Promise<void> {
  const parsed = NewFlagSchema.safeParse(flag);
  if (!parsed.success) {
    throw new RoundsApiError(`Flag not sent: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
  }
  const { error } = await client.from('question_flags').insert(parsed.data);
  if (error) throw new RoundsApiError(`Sending flag: ${error.message}`);
}

const FinishedSessionSchema = z.strictObject({
  script_id: ScriptIdSchema,
  score: z.number().int().min(0).max(6),
  status: z.enum(['missed', 'completed']),
  ended_at: z.string().min(1),
});

/**
 * The student's finished sessions, oldest first: everything progression
 * (rounds, shifts, rank, mastery) is derived from these.
 */
export async function listFinishedSessions(
  client: RoundsClient,
  onReject: RejectHandler = warnRejected,
): Promise<SessionRecord[]> {
  const rows = unwrap(
    await client
      .from('ladder_sessions')
      .select('id, script_id, score, status, ended_at')
      .neq('status', 'in_progress')
      .order('ended_at'),
    'Loading progress',
  );
  const sessions: SessionRecord[] = [];
  const rejected: ParseResult<unknown>['rejected'] = [];
  for (const { id, ...row } of rows) {
    const parsed = FinishedSessionSchema.safeParse(row);
    if (parsed.success) sessions.push(parsed.data);
    else rejected.push({ id, error: parsed.error.message });
  }
  onReject('ladder_sessions', rejected);
  return sessions;
}

export const GRADE_TIMEOUT_MS = 13_000;

/**
 * Grades an answer on the server (`grade-answer` Edge Function). The server
 * loads the question itself, so only the id and the answer are sent. The
 * answer is checked for patient details first and never leaves the device if
 * it fails. Throws `GradeRejectedError` when the answer is refused (422) and `RoundsApiError` on
 * anything else, so callers can fall back to grading locally.
 */
export async function gradeAnswer(
  client: RoundsClient,
  questionId: string,
  answer: string,
  /** Longer than the server's model deadline, so a slow model still returns its local fallback. */
  timeoutMs = GRADE_TIMEOUT_MS,
): Promise<GradeResponse> {
  if (!AnswerTextSchema.safeParse(answer).success) {
    throw new GradeRejectedError('Answer looks like it contains patient details');
  }
  const { data, error } = await client.functions.invoke<unknown>('grade-answer', {
    body: { question_id: questionId, answer },
    timeout: timeoutMs,
  });
  if (error) {
    // `context` is the fetch Response for HTTP errors.
    const response: unknown = (error as { context?: unknown }).context;
    if (response instanceof Response && response.status === 422) {
      const body: unknown = await response
        .clone()
        .json()
        .catch(() => null);
      const message =
        body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
          ? body.error
          : `HTTP ${response.status}`;
      throw new GradeRejectedError(`Grading: ${message}`);
    }
    throw new RoundsApiError(`Grading: ${error.message}`);
  }
  const parsed = GradeResponseSchema.safeParse(data);
  if (!parsed.success) throw new RoundsApiError('Grading: unexpected response');
  return parsed.data;
}
