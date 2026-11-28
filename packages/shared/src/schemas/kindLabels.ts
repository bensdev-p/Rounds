/**
 * What each kind of script calls things: its rung labels, its name and the
 * names of the organ systems. The six rungs are positional (the `ladder_rung`
 * enum, score 0–6, progression); only their labels change by kind
 * (developer's decision, 27 Nov 2026; DESIGN.md → Script kinds).
 */
import type { ScriptKind, System } from './illnessScript.ts';
import type { Rung } from './rung.ts';

export const RUNG_LABELS_BY_KIND: Record<ScriptKind, Record<Rung, string>> = {
  disease: {
    recall: 'Recall',
    second_order: 'Next most common',
    differentiate: 'Tell it apart',
    workup: 'Workup',
    management: 'Management',
    pearl: 'Pearl',
  },
  drug: {
    recall: 'Class',
    second_order: 'Mechanism',
    differentiate: 'Uses',
    workup: 'Adverse effects',
    management: 'Tell it apart',
    pearl: 'Pearl',
  },
  bug: {
    recall: 'Identify',
    second_order: 'Virulence',
    differentiate: 'Diseases',
    workup: 'Diagnosis',
    management: 'Treatment',
    pearl: 'Pearl',
  },
  pathway: {
    recall: 'Step',
    second_order: 'Regulation',
    differentiate: 'Deficiency',
    workup: 'Tell it apart',
    management: 'Treatment',
    pearl: 'Pearl',
  },
};

/** A rung's label for a kind of script. Diseases when the kind isn't known. */
export function rungLabel(rung: Rung, kind: ScriptKind = 'disease'): string {
  return RUNG_LABELS_BY_KIND[kind][rung];
}

export const KIND_NAMES: Record<ScriptKind, string> = {
  disease: 'Disease',
  drug: 'Drug',
  bug: 'Bug',
  pathway: 'Pathway',
};

/** Short names, for chips ("Cardio" in wireframe 03). */
export const SYSTEM_NAMES: Record<System, string> = {
  cardio: 'Cardio',
  pulm: 'Pulm',
  renal: 'Renal',
  gi: 'GI',
  endo: 'Endo',
  repro: 'Repro',
  heme_onc: 'Heme/onc',
  neuro: 'Neuro',
  psych: 'Psych',
  msk: 'MSK',
  derm: 'Derm',
  immuno: 'Immuno',
  general: 'General',
};
