/**
 * Anki links (M3.2): the developer picks AnKing notes per script and rung in
 * the Rounds linker add-on (`packages/anki-linker`), which saves them to a
 * links file. `pnpm content:link-anki <file>` brings them into
 * content/scripts/*.json as `anki_refs`.
 *
 * The file holds note ids and rungs only. It is a strict schema, so a file
 * carrying card text or AnKing tag names is refused (domain rule 6).
 */
import { z } from 'zod';
import {
  AnkiRefSchema,
  IllnessScriptSchema,
  ScriptIdSchema,
  type AnkiRef,
} from '../schemas/illnessScript.ts';
import { rungIndex } from '../schemas/rung.ts';
import type { ContentFile } from './contentFile.ts';

export const AnkiLinksFileSchema = z.strictObject({
  format: z.literal('rounds-anki-links'),
  version: z.literal(1),
  /** Script id → the notes the developer confirmed. Scripts left out keep their links. */
  scripts: z.record(ScriptIdSchema, z.array(AnkiRefSchema)),
});
export type AnkiLinksFile = z.infer<typeof AnkiLinksFileSchema>;

/** Core notes first, then rungs up the ladder; ids in numeric order within each. */
export function sortAnkiRefs(refs: readonly AnkiRef[]): AnkiRef[] {
  const order = (r: AnkiRef) => (r.rung ? rungIndex(r.rung) + 1 : 0);
  return [...refs].sort((a, b) => {
    const byRung = order(a) - order(b);
    if (byRung !== 0) return byRung;
    return a.id.length - b.id.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  });
}

export interface LinkSummary {
  scriptId: string;
  before: number;
  after: number;
  changed: boolean;
}

/**
 * Replaces `anki_refs` on each script named in the links file. Returns the
 * files that changed, a line per named script, and any problems (unknown
 * scripts, duplicates, caps). Nothing should be written when there are problems.
 */
export function applyAnkiLinks(
  files: readonly ContentFile[],
  links: AnkiLinksFile,
): { changed: ContentFile[]; summary: LinkSummary[]; problems: string[] } {
  const byId = new Map(files.map((f) => [f.script.id, f]));
  const changed: ContentFile[] = [];
  const summary: LinkSummary[] = [];
  const problems: string[] = [];

  for (const [scriptId, refs] of Object.entries(links.scripts)) {
    const file = byId.get(scriptId);
    if (!file) {
      problems.push(`${scriptId}: no script with this id in content/scripts`);
      continue;
    }
    const next = sortAnkiRefs(refs.map((r) => (r.rung ? r : { kind: r.kind, id: r.id })));
    const script = { ...file.script, anki_refs: next };
    const parsed = IllnessScriptSchema.safeParse(script);
    if (!parsed.success) {
      problems.push(...parsed.error.issues.map((i) => `${scriptId}: ${i.message}`));
      continue;
    }
    const isChanged = JSON.stringify(file.script.anki_refs) !== JSON.stringify(next);
    summary.push({
      scriptId,
      before: file.script.anki_refs.length,
      after: next.length,
      changed: isChanged,
    });
    if (isChanged) changed.push({ ...file, script: parsed.data });
  }
  return { changed, summary, problems };
}
