/**
 * Converts between database rows and the shared Zod types. Rows hold review
 * metadata in columns and the rest in `content jsonb`; these functions are the
 * only place that split is known. Every read is validated (CLAUDE.md: validate
 * every API/DB boundary).
 */
import {
  IllnessScriptSchema,
  type IllnessScript,
  type IllnessScriptContent,
} from '../schemas/illnessScript.ts';
import { QuestionSchema, type Question } from '../schemas/question.ts';
import type { Json, Tables, TablesInsert } from './database.types.ts';

export type ScriptRow = Tables<'illness_scripts'>;
export type QuestionRow = Tables<'questions'>;

function asObject(content: Json): Record<string, unknown> {
  return content !== null && typeof content === 'object' && !Array.isArray(content) ? content : {};
}

/** Postgres returns `+00:00` offsets and microseconds; normalize to ISO for Zod. */
function toIso(timestamp: string | null): string | null {
  if (timestamp === null) return null;
  const ms = Date.parse(timestamp);
  return Number.isNaN(ms) ? timestamp : new Date(ms).toISOString();
}

export function scriptFromRow(row: ScriptRow): IllnessScript {
  return IllnessScriptSchema.parse({
    ...asObject(row.content),
    // Columns win over anything with the same name inside content.
    id: row.id,
    version: row.version,
    status: row.status,
    reviewed_by: row.reviewed_by,
    reviewed_at: toIso(row.reviewed_at),
  });
}

export function scriptToRow(script: IllnessScript): TablesInsert<'illness_scripts'> {
  const { id, version, status, reviewed_by, reviewed_at, ...content } = script;
  const clinical: IllnessScriptContent = content;
  return { id, version, status, reviewed_by, reviewed_at, content: clinical as NonNullable<Json> };
}

export function questionFromRow(row: QuestionRow): Question {
  return QuestionSchema.parse({
    ...asObject(row.content),
    id: row.id,
    script_id: row.script_id,
    script_version: row.script_version,
    rung: row.rung,
  });
}

export function questionToRow(question: Question): TablesInsert<'questions'> {
  const { id, script_id, script_version, rung, ...content } = question;
  return { id, script_id, script_version, rung, content: content as NonNullable<Json> };
}

export interface ParseResult<T> {
  items: T[];
  /** Rows that failed validation, with the reason. Callers log these; they are skipped. */
  rejected: { id: string; error: string }[];
}

/** Parses rows, skipping (not throwing on) any that fail validation. */
export function parseRows<R extends { id: string }, T>(
  rows: readonly R[],
  parse: (row: R) => T,
): ParseResult<T> {
  const result: ParseResult<T> = { items: [], rejected: [] };
  for (const row of rows) {
    try {
      result.items.push(parse(row));
    } catch (error) {
      result.rejected.push({
        id: row.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return result;
}
