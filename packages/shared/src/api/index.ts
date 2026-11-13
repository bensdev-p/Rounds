/**
 * Rounds API client. Thin functions over a Supabase client; RLS decides what
 * each call can see. Everything read is validated with the shared schemas, and
 * everything written is validated before it leaves the client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../db/database.types';
import { parseRows, questionFromRow, scriptFromRow, type ParseResult } from '../db/rows';
import type { Confusable } from '../grading/localGrader';
import { ladderScore, type LadderState } from '../ladder/engine';
import type { PersonaId } from '../ladder/personas';
import { AttemptSchema, type Attempt } from '../schemas/attempt';
import type { IllnessScript } from '../schemas/illnessScript';
import { traceQuestionToScript, type Question } from '../schemas/question';

export type RoundsClient = SupabaseClient<Database>;

export class RoundsApiError extends Error {
  override name = 'RoundsApiError';
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

/** Approved scripts that have at least one question, with the student's best rung on each. */
export async function listPimpableScripts(
  client: RoundsClient,
  onReject: RejectHandler = warnRejected,
): Promise<ScriptSummary[]> {
  const [scripts, questions, progress] = await Promise.all([
    client.from('illness_scripts').select('*').eq('status', 'approved').order('id'),
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
