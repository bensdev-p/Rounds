/**
 * Rounds API client. Thin functions over a Supabase client; RLS decides what
 * each call can see. Everything read is validated with the shared schemas, and
 * everything written is validated before it leaves the client.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { Database } from '../db/database.types.ts';
import {
  parseRows,
  questionFromRow,
  scriptFromRow,
  type ParseResult,
  type QuestionRow,
  type ScriptRow,
} from '../db/rows.ts';
import type { Confusable } from '../grading/localGrader.ts';
import { isFixtureScript } from '../fixtures/index.ts';
import { ladderScore, type LadderState } from '../ladder/engine.ts';
import { drillScore, type DrillState } from '../review/drill.ts';
import type { MissRecord } from '../review/review.ts';
import type { PersonaId } from '../ladder/personas.ts';
import {
  AnswerTextSchema,
  AttemptSchema,
  MissTagSchema,
  GradeResponseSchema,
  type Attempt,
  type GradeResponse,
} from '../schemas/attempt.ts';
import { ScriptIdSchema, type IllnessScript } from '../schemas/illnessScript.ts';
import type { SessionRecord } from '../progress/progression.ts';
import { NewFlagSchema, type NewFlag } from '../schemas/flag.ts';
import {
  NewPatientLogSchema,
  PatientLogSchema,
  type NewPatientLog,
  type PatientLog,
} from '../schemas/patientLog.ts';
import { QuestionIdSchema, traceQuestionToScript, type Question } from '../schemas/question.ts';
import { ProfileSchema, type Profile } from '../profile/profile.ts';
import type { CueId, VoiceSpeed } from '../voice/voice.ts';
import {
  AnkiActionRowSchema,
  AnkiCardStateSchema,
  AnkiPairingCodeSchema,
  AnkiPairingSchema,
  QueueAnkiActionSchema,
  type AnkiActionRow,
  type AnkiCardState,
  type AnkiPairing,
  type AnkiPairingCode,
  type QueueAnkiAction,
} from '../anki/anki.ts';

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

/**
 * Visible scripts with at least one question, and the student's best rung on
 * each. The fictional test fixtures are left out unless `includeFixtures`.
 */
export async function listPimpableScripts(
  client: RoundsClient,
  onReject: RejectHandler = warnRejected,
  { includeFixtures = false }: { includeFixtures?: boolean } = {},
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
    .filter((s) => s.questionCount > 0 && (includeFixtures || !isFixtureScript(s.script.id)));
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

  const content = ladderContentFromRows(
    scriptResult.data,
    unwrap(questionResult, 'Loading questions'),
    onReject,
  );
  if (!content) return null;

  const confusedIds = content.script.confused_with.map((c) => c.script_id);
  if (confusedIds.length > 0) {
    // Only approved scripts are visible, so drafts never show up as confusables.
    const others = unwrap(
      await client.from('illness_scripts').select('*').in('id', confusedIds),
      'Loading related scripts',
    );
    content.confusables = confusablesFromRows(others, onReject);
  }
  return content;
}

/** Validates a script and its questions, keeping only questions that trace to the script. */
function ladderContentFromRows(
  scriptRow: ScriptRow,
  questionRows: readonly QuestionRow[],
  onReject: RejectHandler,
): LadderContent | null {
  const scriptParse = parseRows([scriptRow], scriptFromRow);
  onReject('illness_scripts', scriptParse.rejected);
  const script = scriptParse.items[0];
  if (!script) return null;

  const questionParse = parseRows(questionRows, questionFromRow);
  const untraced: ParseResult<unknown>['rejected'] = [];
  const questions = questionParse.items.filter((q) => {
    const issues = traceQuestionToScript(q, script);
    if (issues.length > 0) {
      untraced.push({ id: q.id, error: issues.map((i) => `${i.path}: ${i.message}`).join('; ') });
    }
    return issues.length === 0;
  });
  onReject('questions', [...questionParse.rejected, ...untraced]);
  return { script, questions, confusables: [] };
}

function confusablesFromRows(rows: readonly ScriptRow[], onReject: RejectHandler): Confusable[] {
  const parsed = parseRows(rows, scriptFromRow);
  onReject('illness_scripts', parsed.rejected);
  return parsed.items.map((s) => ({ script_id: s.id, names: [s.name, ...s.aliases] }));
}

// ─── Daily pimp (M4.3) ──────────────────────────────────────────────────────

/**
 * The scripts the daily pimp may use for the caller: approved ones, plus
 * in-review ones for testers. Works signed out. Pick the day's script from
 * it with `pickDailyScript`.
 */
export async function getDailyPool(client: RoundsClient): Promise<string[]> {
  const { data, error } = await client.rpc('daily_pool');
  if (error) throw new RoundsApiError(`Loading the daily pool: ${error.message}`);
  return z.array(ScriptIdSchema).parse(data ?? []);
}

/** The shape `daily_content()` returns: table rows, validated field by field below. */
const DailyContentSchema = z.object({
  script: z.looseObject({ id: z.string() }),
  questions: z.array(z.looseObject({ id: z.string() })),
  related: z.array(z.looseObject({ id: z.string() })),
});

/** One script from the caller's daily pool, ready for a ladder; null if it isn't in the pool. */
export async function getDailyContent(
  client: RoundsClient,
  scriptId: string,
  onReject: RejectHandler = warnRejected,
): Promise<LadderContent | null> {
  const { data, error } = await client.rpc('daily_content', {
    p_script_id: ScriptIdSchema.parse(scriptId),
  });
  if (error) throw new RoundsApiError(`Loading the daily pimp: ${error.message}`);
  if (data === null) return null;
  const parsed = DailyContentSchema.safeParse(data);
  if (!parsed.success) throw new RoundsApiError('Loading the daily pimp: unexpected response');
  // These are table rows (to_jsonb); scriptFromRow and questionFromRow validate every field.
  const content = ladderContentFromRows(
    parsed.data.script as unknown as ScriptRow,
    parsed.data.questions as unknown as QuestionRow[],
    onReject,
  );
  if (!content) return null;
  content.confusables = confusablesFromRows(
    parsed.data.related as unknown as ScriptRow[],
    onReject,
  );
  return content;
}

/** True when the signed-in, non-anonymous user's email is on the tester list. */
export async function isTester(client: RoundsClient): Promise<boolean> {
  const { data, error } = await client.rpc('is_tester');
  if (error) throw new RoundsApiError(`Checking the tester list: ${error.message}`);
  return data === true;
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

/**
 * Starts a mix-up drill session on a pair. It is stored as a session of kind
 * 'drill' on the first script, naming the second; finishing it never changes
 * the best rung, and progression ignores it. Returns the session id.
 */
export async function startDrillSession(
  client: RoundsClient,
  script: Pick<IllnessScript, 'id' | 'version'>,
  partnerId: string,
  persona: PersonaId,
): Promise<string> {
  const { data, error } = await client
    .from('ladder_sessions')
    .insert({
      script_id: script.id,
      script_version: script.version,
      persona,
      kind: 'drill',
      partner_script_id: partnerId,
    })
    .select('id')
    .single();
  if (error) throw new RoundsApiError(`Starting drill: ${error.message}`);
  return data.id;
}

/** Closes a drill. Its score is the number of questions answered before the miss. */
export async function finishDrill(
  client: RoundsClient,
  sessionId: string,
  state: DrillState,
): Promise<void> {
  if (state.status === 'in_progress') {
    throw new RoundsApiError('Cannot finish a drill that is still in progress');
  }
  unwrap(
    await client.rpc('finish_ladder_session', {
      p_session_id: sessionId,
      p_status: state.status,
      p_score: drillScore(state),
    }),
    'Finishing drill',
  );
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

/**
 * Logs a patient: diagnosis label, matching script (or null) and rotation.
 * Validated first, including the patient log's patient-detail check, so a
 * bad label never leaves the device.
 */
export async function logPatient(client: RoundsClient, log: NewPatientLog): Promise<PatientLog> {
  const parsed = NewPatientLogSchema.safeParse(log);
  if (!parsed.success) {
    throw new RoundsApiError(`Log not saved: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
  }
  const { label, script_id, rotation } = parsed.data;
  const { data, error } = await client
    .from('patient_logs')
    .insert({ label, script_id, rotation })
    .select('id, label, script_id, rotation, logged_at')
    .single();
  if (error) throw new RoundsApiError(`Saving log: ${error.message}`);
  return PatientLogSchema.parse({ ...data, logged_at: new Date(data.logged_at).toISOString() });
}

/** The student's logs since `since` (an ISO timestamp, e.g. local midnight), oldest first. */
export async function listLogsSince(
  client: RoundsClient,
  since: string,
  onReject: RejectHandler = warnRejected,
): Promise<PatientLog[]> {
  const rows = unwrap(
    await client
      .from('patient_logs')
      .select('id, label, script_id, rotation, logged_at')
      .gte('logged_at', since)
      .order('logged_at'),
    'Loading logs',
  );
  const parsed = parseRows(rows, (row) =>
    PatientLogSchema.parse({ ...row, logged_at: new Date(row.logged_at).toISOString() }),
  );
  onReject('patient_logs', parsed.rejected);
  return parsed.items;
}

const QuestionIdsSchema = z.array(z.strictObject({ question_id: QuestionIdSchema }));

/**
 * The questions asked in the student's most recent finished session on a
 * script, so the next session can pick different ones (`pickLadder`'s
 * `avoid`). Empty if the student has never finished a session on it.
 */
export async function lastAskedQuestionIds(
  client: RoundsClient,
  scriptId: string,
): Promise<string[]> {
  const sessions = unwrap(
    await client
      .from('ladder_sessions')
      .select('id')
      .eq('script_id', scriptId)
      .eq('kind', 'ladder')
      .neq('status', 'in_progress')
      .order('ended_at', { ascending: false })
      .limit(1),
    'Loading last session',
  );
  const last = sessions[0];
  if (!last) return [];
  const rows = unwrap(
    await client.from('attempts').select('question_id').eq('session_id', last.id),
    'Loading last questions',
  );
  const parsed = QuestionIdsSchema.safeParse(rows);
  if (!parsed.success) throw new RoundsApiError(`Loading last questions: ${parsed.error.message}`);
  return parsed.data.map((r) => r.question_id);
}

const MissRowSchema = z.object({
  id: z.string().min(1),
  question_id: QuestionIdSchema,
  miss_tag: MissTagSchema,
  matched: z.array(z.string()),
  created_at: z.string().min(1),
  ladder_sessions: z.object({ kind: z.enum(['ladder', 'drill']) }),
});

/**
 * The student's missed attempts since `since` (ISO), oldest first, each with
 * the question it was on, for Review. Misses on questions the student can no
 * longer see (or that no longer trace to their script) are left out.
 */
export async function listMissesSince(
  client: RoundsClient,
  since: string,
  onReject: RejectHandler = warnRejected,
): Promise<MissRecord[]> {
  const rows = unwrap(
    await client
      .from('attempts')
      .select('id, question_id, miss_tag, matched, created_at, ladder_sessions!inner(kind)')
      .eq('passed', false)
      .gte('created_at', since)
      .order('created_at'),
    'Loading misses',
  );
  const misses: z.infer<typeof MissRowSchema>[] = [];
  const rejected: ParseResult<unknown>['rejected'] = [];
  for (const row of rows) {
    const parsed = MissRowSchema.safeParse(row);
    if (parsed.success) misses.push(parsed.data);
    else rejected.push({ id: row.id, error: parsed.error.message });
  }
  onReject('attempts', rejected);
  if (misses.length === 0) return [];

  const ids = [...new Set(misses.map((m) => m.question_id))];
  const questionRows = unwrap(
    await client.from('questions').select('*').in('id', ids),
    'Loading missed questions',
  );
  const questions = parseRows(questionRows, questionFromRow);
  onReject('questions', questions.rejected);
  const byId = new Map(questions.items.map((q) => [q.id, q]));

  return misses.flatMap((m) => {
    const question = byId.get(m.question_id);
    if (!question) return [];
    return [
      {
        attempt_id: m.id,
        script_id: question.script_id,
        question,
        miss_tag: m.miss_tag,
        matched: m.matched,
        created_at: new Date(m.created_at).toISOString(),
        session_kind: m.ladder_sessions.kind,
      },
    ];
  });
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
      .eq('kind', 'ladder')
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

// ─── Profile ────────────────────────────────────────────────────────────────

const PROFILE_COLUMNS =
  'year, rotation, rotation_started_on, rotation_weeks, daily_goal, persona, answer_timeout, voice_speed';

/** The student's profile, or null before onboarding. */
export async function getProfile(client: RoundsClient): Promise<Profile | null> {
  const { data, error } = await client.from('profiles').select(PROFILE_COLUMNS).maybeSingle();
  if (error) throw new RoundsApiError(`Loading profile: ${error.message}`);
  if (data === null) return null;
  const parsed = ProfileSchema.safeParse(data);
  if (!parsed.success) throw new RoundsApiError('Loading profile: unexpected row');
  return parsed.data;
}

/** Creates or replaces the student's profile (onboarding, Settings). */
export async function saveProfile(client: RoundsClient, profile: Profile): Promise<Profile> {
  const parsed = ProfileSchema.safeParse(profile);
  if (!parsed.success) {
    throw new RoundsApiError(`Profile not saved: ${parsed.error.issues[0]?.message ?? 'invalid'}`);
  }
  const { error } = await client.from('profiles').upsert(parsed.data, { onConflict: 'user_id' });
  if (error) throw new RoundsApiError(`Saving profile: ${error.message}`);
  return parsed.data;
}

// ─── Accounts ───────────────────────────────────────────────────────────────
// Every student starts as an anonymous user (no account wall, wireframe 01
// note 2). Signing in adds an email or Apple ID to that same user, so the id,
// and every row the student owns, stays. If the email already has an account,
// it's a sign-in to that account instead, and this device's anonymous history
// stays behind.

export const EmailSchema = z.email();

/** Which code the student was sent: one that adds the email to this user, or a sign-in code. */
export type EmailCodeKind = 'add_email' | 'sign_in';

/**
 * Adds an email to the anonymous student and sends a 6-digit code to confirm
 * it. Returns 'exists' (nothing sent) when the email already has an account:
 * the screen warns, then calls `sendSignInCode`.
 */
export async function sendAddEmailCode(
  client: RoundsClient,
  email: string,
): Promise<'sent' | 'exists'> {
  const address = EmailSchema.parse(email.trim());
  const { error } = await client.auth.updateUser({ email: address });
  if (!error) return 'sent';
  if (error.code === 'email_exists') return 'exists';
  throw new RoundsApiError(`Sending code: ${error.message}`);
}

/** Sends a 6-digit sign-in code to an email that already has an account. Never creates one. */
export async function sendSignInCode(client: RoundsClient, email: string): Promise<void> {
  const address = EmailSchema.parse(email.trim());
  const { error } = await client.auth.signInWithOtp({
    email: address,
    options: { shouldCreateUser: false },
  });
  if (error) throw new RoundsApiError(`Sending code: ${error.message}`);
}

export class WrongCodeError extends RoundsApiError {
  override name = 'WrongCodeError';
}

/** Checks the 6-digit code. On success the client is signed in to the account. */
export async function verifyEmailCode(
  client: RoundsClient,
  email: string,
  code: string,
  kind: EmailCodeKind,
): Promise<void> {
  const { error } = await client.auth.verifyOtp({
    email: email.trim(),
    token: code.replace(/\s/g, ''),
    type: kind === 'add_email' ? 'email_change' : 'email',
  });
  if (!error) return;
  if (error.code === 'otp_expired' || error.status === 403) throw new WrongCodeError(error.message);
  throw new RoundsApiError(`Checking code: ${error.message}`);
}

/**
 * Deletes the student's account and everything they own (App Store rule
 * 5.1.1(v)). Runs in the `delete-account` Edge Function, which deletes only
 * the caller. Sign out locally afterwards.
 */
export async function deleteAccount(client: RoundsClient): Promise<void> {
  const { error } = await client.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw new RoundsApiError(`Deleting account: ${error.message}`);
}

// ─── Voice (M2.5) ───────────────────────────────────────────────────────────

export const SpeechTokenSchema = z.object({
  vendor: z.enum(['deepgram', 'fake']),
  token: z.string().min(1),
  expires_in: z.number().positive(),
  model: z.string().min(1),
});
export type SpeechToken = z.infer<typeof SpeechTokenSchema>;

/** A short-lived token to stream the mic straight to the speech-to-text vendor (`speech-token`). */
export async function getSpeechToken(client: RoundsClient): Promise<SpeechToken> {
  const { data, error } = await client.functions.invoke<unknown>('speech-token', {
    method: 'POST',
  });
  if (error) throw new RoundsApiError(`Speech token: ${error.message}`);
  const parsed = SpeechTokenSchema.safeParse(data);
  if (!parsed.success) throw new RoundsApiError('Speech token: unexpected response');
  return parsed.data;
}

/** What the attending says: a question, or a fixed cue ("Mm-hm."). */
export type SpeechRequest =
  | { question_id: string; persona: PersonaId; speed: VoiceSpeed }
  | { cue: CueId; persona: PersonaId; speed: VoiceSpeed };

/** Raw 16-bit little-endian mono PCM from `speak`, at this rate. */
export const SPEECH_SAMPLE_RATE = 24_000;

/**
 * Fetches the attending's voice from the `speak` Edge Function. Returns the
 * Response so callers can stream it (native passes expo/fetch, whose body
 * streams; React Native's own fetch doesn't).
 */
export async function fetchSpeech(
  client: RoundsClient,
  functionsUrl: string,
  publishableKey: string,
  request: SpeechRequest,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<Response> {
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new RoundsApiError('Voice: not signed in');
  const params = new URLSearchParams({
    ...('question_id' in request ? { question_id: request.question_id } : { cue: request.cue }),
    persona: request.persona,
    speed: String(request.speed),
  });
  const response = await fetchImpl(`${functionsUrl}/speak?${params}`, {
    headers: { Authorization: `Bearer ${token}`, apikey: publishableKey },
    signal: signal ?? null,
  });
  if (!response.ok) throw new RoundsApiError(`Voice: HTTP ${response.status}`);
  return response;
}

// ─── Anki (M3.3) ────────────────────────────────────────────────────────────

/** A one-time code for the Anki add-on (`anki-pair`, Settings → Anki). */
export async function startAnkiPairing(client: RoundsClient): Promise<AnkiPairingCode> {
  const { data, error } = await client.functions.invoke<unknown>('anki-pair', {
    method: 'POST',
    body: { op: 'start' },
  });
  if (error) throw new RoundsApiError(`Anki code: ${error.message}`);
  const parsed = AnkiPairingCodeSchema.safeParse(data);
  if (!parsed.success) throw new RoundsApiError('Anki code: unexpected response');
  return parsed.data;
}

/** The student's Anki pairing (pending code or connection), or null. */
export async function getAnkiPairing(client: RoundsClient): Promise<AnkiPairing | null> {
  const result = await client
    .from('anki_pairings')
    .select('code_expires_at, claimed_at, last_sync_at')
    .maybeSingle();
  if (result.error) throw new RoundsApiError(`Anki connection: ${result.error.message}`);
  if (!result.data) return null;
  const parsed = AnkiPairingSchema.safeParse(result.data);
  if (!parsed.success) throw new RoundsApiError('Anki connection: unexpected row');
  return parsed.data;
}

/** Disconnects Anki: the add-on's token stops working and uploaded stats are forgotten. */
export async function disconnectAnki(client: RoundsClient): Promise<void> {
  const { data } = await client.auth.getUser();
  if (!data.user) throw new RoundsApiError('Disconnecting Anki: not signed in');
  const { error } = await client.from('anki_pairings').delete().eq('user_id', data.user.id);
  if (error) throw new RoundsApiError(`Disconnecting Anki: ${error.message}`);
}

/**
 * Queues an Anki action for a miss: the rung's linked notes, or the script's
 * core notes. Returns the action id, or null when the script has no linked notes.
 */
export async function queueAnkiAction(
  client: RoundsClient,
  action: QueueAnkiAction,
): Promise<string | null> {
  const input = QueueAnkiActionSchema.parse(action);
  const { data, error } = await client.rpc('queue_anki_action', {
    p_script_id: input.script_id,
    p_rung: input.rung ?? '',
    p_kind: input.kind,
  });
  if (error) throw new RoundsApiError(`Queueing Anki action: ${error.message}`);
  return data ?? null;
}

// ─── Anki in the app (M3.4) ─────────────────────────────────────────────────

/** The last upload's cards (ids and suspended only), for these notes or all of them. */
export async function listAnkiCardStates(
  client: RoundsClient,
  noteIds?: readonly number[],
): Promise<AnkiCardState[]> {
  let query = client.from('anki_card_stats').select('card_id, note_id, suspended');
  if (noteIds) query = query.in('note_id', [...noteIds]);
  const { data, error } = await query;
  if (error) throw new RoundsApiError(`Anki cards: ${error.message}`);
  const parsed = AnkiCardStateSchema.array().safeParse(data);
  if (!parsed.success) throw new RoundsApiError('Anki cards: unexpected rows');
  return parsed.data;
}

/** The student's Anki actions not yet applied, plus those applied since `since`. */
export async function listAnkiActions(client: RoundsClient, since: Date): Promise<AnkiActionRow[]> {
  const { data, error } = await client
    .from('anki_actions')
    .select('id, kind, script_id, rung, note_ids, created_at, applied_at, applied_count')
    .or(`applied_at.is.null,applied_at.gte."${since.toISOString()}"`)
    .order('created_at');
  if (error) throw new RoundsApiError(`Anki actions: ${error.message}`);
  const parsed = AnkiActionRowSchema.array().safeParse(data);
  if (!parsed.success) throw new RoundsApiError('Anki actions: unexpected rows');
  return parsed.data;
}
