import { detectPhi, MAX_ANSWER_LENGTH, QuestionIdSchema } from '@rounds/shared';
import { getLadderContent, type RoundsClient } from '@rounds/shared/api';
import { z } from 'zod';
import type { LlmProvider, LlmUsage } from '../_shared/llm/types.ts';
import { gradeAnswerStep, type GradeOutcome } from './grade.ts';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BodySchema = z.strictObject({
  question_id: QuestionIdSchema,
  answer: z.string().max(MAX_ANSWER_LENGTH),
});

/** One structured log line per request. Never includes the answer text. */
export interface GradeLog {
  question_id: string;
  outcome: GradeOutcome;
  model: string | null;
  latency_ms: number;
  usage: LlmUsage | null;
  discarded: string[];
}

export interface HandlerDeps {
  /** null: no API key configured, grade locally only. */
  llm: LlmProvider | null;
  /** A database client that acts as the caller (their JWT), so RLS applies. */
  dbFor: (request: Request) => RoundsClient;
  /** Overall budget for the model call, retries included. */
  llmDeadlineMs: number;
  log: (entry: GradeLog) => void;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function createHandler(deps: HandlerDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    if (request.method !== 'POST') return json(405, { error: 'Use POST' });

    const body = BodySchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return json(400, { error: 'Expected { question_id, answer }' });
    const { question_id, answer } = body.data;

    // Before anything else, so patient details never reach a third party (domain rule 5).
    if (detectPhi(answer).blocked) {
      return json(422, { error: 'Answer looks like it contains patient details' });
    }

    const db = deps.dbFor(request);
    const { data: row, error } = await db
      .from('questions')
      .select('script_id')
      .eq('id', question_id)
      .maybeSingle();
    if (error) return json(500, { error: 'Could not load the question' });
    if (!row) return json(404, { error: 'Question not found' });

    // Approved content only (RLS), and only questions that trace to their script.
    const content = await getLadderContent(db, row.script_id, () => {}).catch(() => null);
    const question = content?.questions.find((q) => q.id === question_id);
    if (!content || !question) return json(404, { error: 'Question not found' });

    const started = Date.now();
    const step = await gradeAnswerStep({
      question,
      script: content.script,
      confusables: content.confusables,
      answer,
      llm: deps.llm,
      deadlineMs: deps.llmDeadlineMs,
    });
    deps.log({
      question_id,
      outcome: step.outcome,
      model: step.model,
      latency_ms: Date.now() - started,
      usage: step.usage,
      discarded: step.discarded,
    });
    return json(200, step.response);
  };
}
