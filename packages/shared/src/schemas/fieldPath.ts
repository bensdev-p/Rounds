import { z } from 'zod';

/**
 * A pointer to a fact inside an illness script, e.g. `key_findings.labs[1]`,
 * `management.first_line`, `confused_with[0].how_to_tell_apart`.
 *
 * Questions use these to prove every accepted answer traces to the script
 * (CLAUDE.md domain rule 1). Difficulty tiers use them to label facts.
 */
const SEGMENT = '[a-z_]+(?:\\[\\d+\\])?';
export const FIELD_PATH_RE = new RegExp(`^${SEGMENT}(?:\\.${SEGMENT})*$`);

export const FieldPathSchema = z.string().regex(FIELD_PATH_RE, 'Invalid field path');
export type FieldPath = z.infer<typeof FieldPathSchema>;

type Token = string | number;

function tokenize(path: string): Token[] {
  const tokens: Token[] = [];
  for (const segment of path.split('.')) {
    const match = /^([a-z_]+)(?:\[(\d+)\])?$/.exec(segment);
    if (!match?.[1]) return [];
    tokens.push(match[1]);
    if (match[2] !== undefined) tokens.push(Number(match[2]));
  }
  return tokens;
}

/** Returns the value at `path`, or `undefined` if any segment is missing. */
export function resolveFieldPath(root: unknown, path: string): unknown {
  if (!FIELD_PATH_RE.test(path)) return undefined;
  let current: unknown = root;
  for (const token of tokenize(path)) {
    if (typeof token === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[token];
    } else {
      if (current === null || typeof current !== 'object' || Array.isArray(current)) {
        return undefined;
      }
      if (!Object.prototype.hasOwnProperty.call(current, token)) return undefined;
      current = (current as Record<string, unknown>)[token];
    }
    if (current === undefined) return undefined;
  }
  return current;
}

/** Flattens a resolved value into the plain strings it contains. */
export function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(collectStrings);
  if (value !== null && typeof value === 'object') {
    return Object.values(value).flatMap(collectStrings);
  }
  return [];
}
