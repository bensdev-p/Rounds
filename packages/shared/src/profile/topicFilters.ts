/**
 * Filter chips on the topic picker (wireframe 03: All, Cardio, Renal, GI).
 * One chip is on at a time. Systems come first, in the order of `SYSTEMS`;
 * kinds follow when the library holds more than one kind. Only chips that
 * would show something are offered.
 */
import {
  SCRIPT_KINDS,
  SYSTEMS,
  type ScriptKind,
  type System,
} from '../schemas/illnessScript.ts';
import { KIND_NAMES, SYSTEM_NAMES } from '../schemas/kindLabels.ts';

export type TopicFilter =
  { type: 'all' } | { type: 'system'; system: System } | { type: 'kind'; kind: ScriptKind };

export interface TopicChip {
  filter: TopicFilter;
  label: string;
}

interface Filterable {
  kind: ScriptKind;
  systems: readonly System[];
}

/** "Drugs", "Bugs": the plural for a chip. */
const KIND_CHIP: Record<ScriptKind, string> = {
  disease: `${KIND_NAMES.disease}s`,
  drug: `${KIND_NAMES.drug}s`,
  bug: `${KIND_NAMES.bug}s`,
  pathway: `${KIND_NAMES.pathway}s`,
};

export function topicChips(scripts: readonly Filterable[]): TopicChip[] {
  const systems = new Set(scripts.flatMap((s) => s.systems));
  const kinds = new Set(scripts.map((s) => s.kind));
  return [
    { filter: { type: 'all' }, label: 'All' },
    ...SYSTEMS.filter((x) => systems.has(x)).map((system): TopicChip => ({
      filter: { type: 'system', system },
      label: SYSTEM_NAMES[system],
    })),
    ...(kinds.size > 1
      ? SCRIPT_KINDS.filter((k) => kinds.has(k)).map((kind): TopicChip => ({
          filter: { type: 'kind', kind },
          label: KIND_CHIP[kind],
        }))
      : []),
  ];
}

export function matchesTopicFilter(script: Filterable, filter: TopicFilter): boolean {
  switch (filter.type) {
    case 'all':
      return true;
    case 'system':
      return script.systems.includes(filter.system);
    case 'kind':
      return script.kind === filter.kind;
  }
}

export function sameTopicFilter(a: TopicFilter, b: TopicFilter): boolean {
  if (a.type !== b.type) return false;
  if (a.type === 'system' && b.type === 'system') return a.system === b.system;
  if (a.type === 'kind' && b.type === 'kind') return a.kind === b.kind;
  return true;
}
