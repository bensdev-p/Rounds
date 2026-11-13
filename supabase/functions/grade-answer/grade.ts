/**
 * The grading step, shared by the Edge Function (handler.ts) and the offline
 * eval (eval/run.ts), so the eval measures exactly what students get:
 * local matcher first; the model only on a miss; any model failure falls back
 * to the local grade; the model's output is sanitized against the script.
 */
import {
  buildGradingContext,
  gradeLocally,
  LlmGradeOutputSchema,
  sanitizeLlmGrade,
  type Confusable,
  type GradeResponse,
  type IllnessScript,
  type Question,
} from '@rounds/shared';
import { PROMPT_VERSION, renderUserMessage, SYSTEM } from '../_prompts/grade-answer/v1.ts';
import type { LlmProvider, LlmUsage } from '../_shared/llm/types.ts';

export type GradeOutcome = 'local_match' | 'local_only' | 'llm' | `llm_${string}`;

export interface GradeStep {
  response: GradeResponse;
  outcome: GradeOutcome;
  model: string | null;
  usage: LlmUsage | null;
  /** Model matches dropped because they aren't in the script. */
  discarded: string[];
}

export async function gradeAnswerStep(input: {
  question: Question;
  script: IllnessScript;
  confusables: readonly Confusable[];
  answer: string;
  /** null: grade locally only. */
  llm: LlmProvider | null;
  /** Overall budget for the model call, retries included. */
  deadlineMs: number;
}): Promise<GradeStep> {
  const { question, script, confusables, answer, llm, deadlineMs } = input;
  const local = gradeLocally(question, answer, confusables);
  const localStep = (outcome: GradeOutcome, model: string | null = null): GradeStep => ({
    response: { result: local, grader: 'local', grader_version: null },
    outcome,
    model,
    usage: null,
    discarded: [],
  });

  if (local.grade === 'correct') return localStep('local_match');
  if (!llm || answer.trim() === '') return localStep('local_only');

  const call = await llm.generateStructured({
    system: SYSTEM,
    user: renderUserMessage(buildGradingContext(question, script, confusables), answer),
    schema: LlmGradeOutputSchema,
    maxTokens: 4096,
    signal: AbortSignal.timeout(deadlineMs),
  });
  // Grading never blocks the ladder: any model failure falls back to the local grade.
  if (!call.ok) return localStep(`llm_${call.reason}`, llm.model);

  const { result, discarded } = sanitizeLlmGrade(call.value, question, confusables, local);
  return {
    response: { result, grader: 'llm', grader_version: `${PROMPT_VERSION}@${call.model}` },
    outcome: 'llm',
    model: call.model,
    usage: call.usage,
    discarded,
  };
}
