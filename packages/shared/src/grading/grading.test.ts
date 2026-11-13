import { describe, expect, it } from 'vitest';
import { TEST_QUESTIONS, TEST_SCRIPTS } from '../fixtures/index.ts';
import type { ListQuestion } from '../schemas/question.ts';
import { containsAffirmedTerm, normalize } from '../text.ts';
import { LIST_PASS_THRESHOLD, listCredit } from './listCredit.ts';
import { confusablesFor, gradeLocally, splitListAnswer } from './localGrader.ts';

const [zorblax] = TEST_SCRIPTS;
const recall = TEST_QUESTIONS[0]!;
const list = TEST_QUESTIONS.find((q): q is ListQuestion => q.kind === 'list')!;
const confusables = confusablesFor(zorblax!, TEST_SCRIPTS);

describe('normalize', () => {
  it('lowercases, strips accents, punctuation and leading articles', () => {
    expect(normalize('  The Anti-Glimmer   Antibody! ')).toBe('anti glimmer antibody');
    expect(normalize('Ménétrier')).toBe('menetrier');
  });
});

describe('listCredit', () => {
  it('gives partial credit and lists every missed item', () => {
    const credit = listCredit(list, ['glimmer exposure', 'family history']);
    expect(credit.ratio).toBeCloseTo(2 / 3);
    expect(credit.passed).toBe(2 / 3 >= LIST_PASS_THRESHOLD);
    expect(credit.missed).toEqual(['night shift work', 'low blorp diet']);
  });

  it('caps credit at 1 and ignores unknown or duplicate items', () => {
    const all = list.accepted_answers.map((a) => a.answer);
    expect(listCredit(list, [...all, 'made up']).ratio).toBe(1);
    expect(listCredit(list, ['glimmer exposure', 'glimmer exposure']).found).toHaveLength(1);
  });

  it('fails below the threshold', () => {
    expect(listCredit(list, ['glimmer exposure']).passed).toBe(false);
  });
});

describe('splitListAnswer', () => {
  it('splits on commas, semicolons, newlines and conjunctions', () => {
    expect(splitListAnswer('a, b; c\nd and e or f')).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});

describe('gradeLocally: single', () => {
  it('accepts the answer or a synonym, in a sentence', () => {
    expect(gradeLocally(recall, 'Zorblax syndrome').grade).toBe('correct');
    expect(gradeLocally(recall, "I think it's ZBX").grade).toBe('correct');
  });

  it('does not match partial words', () => {
    expect(gradeLocally(recall, 'zorblaxian').grade).toBe('incorrect');
  });

  it('detects a confusable script', () => {
    const result = gradeLocally(recall, 'Quellan fever', confusables);
    expect(result.grade).toBe('incorrect');
    expect(result.confused_with_script_id).toBe('quellan-fever');
  });

  it('prefers the correct answer when both are named', () => {
    expect(gradeLocally(recall, 'Zorblax, not Quellan fever', confusables).grade).toBe('correct');
  });
});

describe('containsAffirmedTerm', () => {
  it.each([
    ['CT angiogram', 'CT angiogram'],
    ['get a CT angiogram', 'CT angiogram'],
    ['there are no P waves', 'no P waves'],
    ["not a V/Q scan, I'd get a CT angiogram", 'CT angiogram'],
    ['anticoagulation, not thrombolysis', 'anticoagulation'],
  ])('"%s" affirms "%s"', (text, term) => {
    expect(containsAffirmedTerm(text, term)).toBe(true);
  });

  it.each([
    ["not a CT angiogram, I'd get a V/Q scan", 'CT angiogram'],
    ['no insulin', 'insulin'],
    ["I wouldn't give tPA", 'tPA'],
    ['rule out pneumonia', 'pneumonia'],
    ['V/Q scan rather than CT angiogram', 'CT angiogram'],
    ['without fluids', 'fluids'],
  ])('"%s" does not affirm "%s"', (text, term) => {
    expect(containsAffirmedTerm(text, term)).toBe(false);
  });
});

describe('gradeLocally: negation', () => {
  it('does not credit a negated answer', () => {
    expect(gradeLocally(recall, 'not Zorblax syndrome').grade).toBe('incorrect');
    expect(gradeLocally(recall, "it isn't ZBX").grade).toBe('incorrect');
  });

  it('does not tag a mix-up the student ruled out', () => {
    expect(gradeLocally(recall, 'not Quellan fever', confusables).confused_with_script_id).toBeNull();
  });

  it('negation applies per list item', () => {
    expect(gradeLocally(list, 'glimmer exposure, not night shift work').matched).toEqual([
      'glimmer exposure',
    ]);
  });
});

describe('gradeLocally: overlapping matches', () => {
  it('credits a phrase once, to the longest match', () => {
    const question = {
      ...list,
      accepted_answers: [
        { answer: 'Haemophilus influenzae', synonyms: ['H influenza'] },
        { answer: 'respiratory viruses', synonyms: ['influenza'] },
        { answer: 'glimmer exposure', synonyms: [] },
      ],
    };
    expect(gradeLocally(question, 'h influenza, glimmer exposure').matched).toEqual([
      'Haemophilus influenzae',
      'glimmer exposure',
    ]);
    expect(gradeLocally(question, 'influenza, H influenza').matched).toEqual([
      'Haemophilus influenzae',
      'respiratory viruses',
    ]);
  });
});

describe('gradeLocally: list', () => {
  it('grades a full list as correct', () => {
    const result = gradeLocally(list, 'glimmer, night shift and family hx');
    expect(result.grade).toBe('correct');
    expect(result.matched).toEqual(['glimmer exposure', 'night shift work', 'family history']);
  });

  it('grades a short list as partial and names what was missed', () => {
    const result = gradeLocally(list, 'glimmer exposure');
    expect(result.grade).toBe('partial');
    expect(result.reason).toMatch(/Missed: night shift work, low blorp diet, family history/);
  });

  it('grades an empty hit as incorrect', () => {
    expect(gradeLocally(list, 'no idea').grade).toBe('incorrect');
  });
});

describe('confusablesFor', () => {
  it('resolves linked scripts to their names and aliases', () => {
    expect(confusables).toEqual([{ script_id: 'quellan-fever', names: ['Quellan fever', 'QF'] }]);
  });
});
