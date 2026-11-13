import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { tokens } from './index.ts';

const tokensJson = fileURLToPath(new URL('../../../../docs/design/tokens.json', import.meta.url));

describe('theme tokens', () => {
  it('match docs/design/tokens.json exactly', () => {
    const source: unknown = JSON.parse(readFileSync(tokensJson, 'utf8'));
    expect(tokens).toEqual(source);
  });
});
