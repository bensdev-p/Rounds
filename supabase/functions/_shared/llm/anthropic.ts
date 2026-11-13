import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { LlmProvider, StructuredRequest, StructuredResult } from './types.ts';

export interface AnthropicOptions {
  apiKey: string;
  model: string;
  effort: 'low' | 'medium' | 'high';
  /** Per HTTP attempt, in milliseconds. */
  timeoutMs: number;
  maxRetries: number;
}

/**
 * Claude via the official SDK, using structured outputs. Server-side refusal
 * fallbacks are on: if a safety classifier declines a (benign) medical
 * question, the API retries on the model Anthropic recommends, in the same call.
 */
export function createAnthropicProvider(options: AnthropicOptions): LlmProvider {
  const client = new Anthropic({
    apiKey: options.apiKey,
    timeout: options.timeoutMs,
    maxRetries: options.maxRetries,
  });

  return {
    name: 'anthropic',
    model: options.model,
    async generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
      try {
        const response = await client.beta.messages.parse(
          {
            model: options.model,
            max_tokens: request.maxTokens,
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default',
            system: request.system,
            messages: [{ role: 'user', content: request.user }],
            output_config: {
              effort: options.effort,
              format: betaZodOutputFormat(request.schema),
            },
          },
          request.signal ? { signal: request.signal } : undefined,
        );

        if (response.stop_reason === 'refusal') {
          return { ok: false, reason: 'refusal', detail: `refused by ${response.model}` };
        }
        if (response.stop_reason === 'max_tokens' || response.parsed_output == null) {
          return {
            ok: false,
            reason: 'invalid_output',
            detail: `no parsed output (stop_reason ${response.stop_reason})`,
          };
        }
        return {
          ok: true,
          value: response.parsed_output as T,
          model: response.model,
          usage: {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
            cache_read_input_tokens: response.usage.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens: response.usage.cache_creation_input_tokens ?? 0,
          },
        };
      } catch (error) {
        if (
          error instanceof Anthropic.APIConnectionTimeoutError ||
          error instanceof Anthropic.APIUserAbortError
        ) {
          return { ok: false, reason: 'timeout', detail: error.message };
        }
        if (error instanceof Anthropic.APIError) {
          return { ok: false, reason: 'error', detail: `${error.status ?? '?'} ${error.message}` };
        }
        // Parse failures from the SDK's schema check land here too.
        return { ok: false, reason: 'invalid_output', detail: String(error) };
      }
    },
  };
}
