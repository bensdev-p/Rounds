import { describe, expect, it } from 'vitest';
import { matchesTopicFilter, sameTopicFilter, topicChips } from './topicFilters.ts';

const cardioDisease = { kind: 'disease', systems: ['cardio'] } as const;
const renalDisease = { kind: 'disease', systems: ['renal', 'endo'] } as const;
const cardioDrug = { kind: 'drug', systems: ['cardio'] } as const;

describe('topic chips', () => {
  it('offers All, then the systems present in SYSTEMS order', () => {
    expect(topicChips([renalDisease, cardioDisease]).map((c) => c.label)).toEqual([
      'All',
      'Cardio',
      'Renal',
      'Endo',
    ]);
  });

  it('adds kind chips only when there is more than one kind', () => {
    expect(topicChips([cardioDisease, cardioDrug]).map((c) => c.label)).toEqual([
      'All',
      'Cardio',
      'Diseases',
      'Drugs',
    ]);
  });

  it('filters by system or kind', () => {
    const scripts = [cardioDisease, renalDisease, cardioDrug];
    expect(scripts.filter((s) => matchesTopicFilter(s, { type: 'all' }))).toHaveLength(3);
    expect(
      scripts.filter((s) => matchesTopicFilter(s, { type: 'system', system: 'cardio' })),
    ).toEqual([cardioDisease, cardioDrug]);
    expect(scripts.filter((s) => matchesTopicFilter(s, { type: 'kind', kind: 'drug' }))).toEqual([
      cardioDrug,
    ]);
  });

  it('compares filters', () => {
    expect(sameTopicFilter({ type: 'all' }, { type: 'all' })).toBe(true);
    expect(
      sameTopicFilter({ type: 'system', system: 'gi' }, { type: 'system', system: 'gi' }),
    ).toBe(true);
    expect(sameTopicFilter({ type: 'system', system: 'gi' }, { type: 'kind', kind: 'bug' })).toBe(
      false,
    );
  });
});
