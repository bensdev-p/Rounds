import type { LlmProvider, StructuredRequest, StructuredResult } from './types.ts';

/** Test provider. Spends nothing; `respond` decides what the "model" says. */
export function createFakeProvider(
  respond: (request: StructuredRequest<unknown>) => StructuredResult<unknown>,
): LlmProvider {
  return {
    name: 'fake',
    model: 'fake',
    generateStructured<T>(request: StructuredRequest<T>): Promise<StructuredResult<T>> {
      const result = respond(request as StructuredRequest<unknown>);
      if (!result.ok) return Promise.resolve(result);
      const parsed = request.schema.safeParse(result.value);
      return Promise.resolve(
        parsed.success
          ? { ...result, value: parsed.data }
          : { ok: false, reason: 'invalid_output', detail: parsed.error.message },
      );
    },
  };
}
