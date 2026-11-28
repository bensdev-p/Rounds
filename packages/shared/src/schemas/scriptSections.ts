/**
 * Every content field of a script, in reading order, grouped into titled
 * sections by kind. The review sheet prints all of it (`renderReviewSheet`);
 * the app's script screen picks a shorter view per kind. Pure, no wording
 * beyond the field names: the text is the script's own.
 */
import type { IllnessScript } from './illnessScript.ts';

export interface SectionPart {
  /** "Risk factors"; null when the section has one unlabelled part. */
  label: string | null;
  items: readonly string[];
}

export interface ScriptSection {
  title: string;
  parts: readonly SectionPart[];
}

const part = (
  label: string | null,
  items: string | readonly string[] | undefined,
): SectionPart => ({
  label,
  items: items === undefined ? [] : typeof items === 'string' ? [items] : items,
});

export function scriptSections(s: IllnessScript): ScriptSection[] {
  const pearls: ScriptSection = { title: 'Pearls', parts: [part(null, s.pearls)] };
  switch (s.kind) {
    case 'disease':
      return [
        {
          title: 'Who gets it',
          parts: [
            part(null, s.epidemiology.who),
            part('Risk factors', s.epidemiology.risk_factors),
          ],
        },
        { title: 'Pathophysiology', parts: [part(null, s.pathophysiology)] },
        {
          title: 'Timeline',
          parts: [part('Onset', s.timeline.onset), part('Course', s.timeline.course)],
        },
        {
          title: 'Key findings',
          parts: [
            part('History', s.key_findings.history),
            part('Exam', s.key_findings.exam),
            part('Labs', s.key_findings.labs),
            part('Imaging', s.key_findings.imaging),
          ],
        },
        {
          title: 'Diagnosis',
          parts: [
            part('Confirmatory tests', s.diagnosis.confirmatory_tests),
            part('Criteria', s.diagnosis.criteria),
          ],
        },
        {
          title: 'Management',
          parts: [
            part('First line', s.management.first_line),
            part('Next line', s.management.next_line),
          ],
        },
        { title: 'Complications', parts: [part(null, s.complications)] },
        pearls,
      ];
    case 'drug':
      return [
        {
          title: 'Class',
          parts: [part(null, s.class), part('Members', s.class_members)],
        },
        { title: 'Mechanism', parts: [part(null, s.mechanism)] },
        { title: 'Pharmacokinetics', parts: [part(null, s.pharmacokinetics)] },
        { title: 'Uses', parts: [part(null, s.indications)] },
        { title: 'Adverse effects', parts: [part(null, s.adverse_effects)] },
        { title: 'Contraindications', parts: [part(null, s.contraindications)] },
        { title: 'Interactions', parts: [part(null, s.interactions)] },
        { title: 'Monitoring', parts: [part(null, s.monitoring)] },
        {
          title: 'Overdose',
          parts: [part('Features', s.overdose.features), part('Treatment', s.overdose.treatment)],
        },
        pearls,
      ];
    case 'bug':
      return [
        {
          title: 'Identify',
          parts: [part(null, s.morphology), part('Lab features', s.lab_features)],
        },
        { title: 'Transmission', parts: [part(null, s.transmission)] },
        { title: 'Virulence', parts: [part(null, s.virulence_factors)] },
        { title: 'Diseases', parts: [part(null, s.diseases)] },
        { title: 'Diagnosis', parts: [part(null, s.diagnosis)] },
        {
          title: 'Treatment',
          parts: [part(null, s.treatment), part('Prevention', s.prevention)],
        },
        pearls,
      ];
    case 'pathway':
      return [
        {
          title: 'What it does',
          parts: [part(null, s.purpose), part('Where', s.location)],
        },
        {
          title: 'Steps',
          parts: [part(null, s.steps), part('Rate-limiting enzyme', s.rate_limiting_enzyme)],
        },
        {
          title: 'Regulation',
          parts: [part(null, s.regulation), part('Cofactors', s.cofactors)],
        },
        { title: 'Deficiency', parts: [part(null, s.deficiencies)] },
        {
          title: 'Treatment',
          parts: [part(null, s.treatment), part('Drug targets', s.drug_targets)],
        },
        pearls,
      ];
  }
}
