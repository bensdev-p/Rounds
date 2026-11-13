/**
 * The `llm` provider interface (CLAUDE.md: keep AI calls behind a provider
 * interface so vendors can be swapped). Callers own the prompt; providers only
 * send it and return validated structured output.
 */
import type { z } from 'zod';

export interface StructuredRequest<T> {
  /** Stable instructions. Kept first so providers can cache them. */
  system: string;
  user: string;
  schema: z.ZodType<T>;
  maxTokens: number;
  signal?: AbortSignal;
}

export interface LlmUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export type StructuredFailure = 'refusal' | 'timeout' | 'error' | 'invalid_output';

export type StructuredResult<T> =
  | { ok: true; value: T; model: string; usage: LlmUsage | null }
  | { ok: false; reason: StructuredFailure; detail: string };

export interface LlmProvider {
  /** e.g. `anthropic`, `fake`. */
  readonly name: string;
  /** The model requested. The one that answered is in each result. */
  readonly model: string;
  generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>>;
}
