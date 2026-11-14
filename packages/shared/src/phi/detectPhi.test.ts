import { describe, expect, it } from 'vitest';
import { detectPhi, diagnosisPhiWarning, phiWarning, type PhiKind } from './detectPhi.ts';

const kinds = (text: string, checkNames = false): PhiKind[] => [
  ...new Set(detectPhi(text, { checkNames }).findings.map((f) => f.kind)),
];

describe('detectPhi', () => {
  it.each<[string, PhiKind]>([
    ['DOB 3/14/62', 'dob'],
    ['born 03-14-1962', 'dob'],
    ['1962-03-14', 'dob'],
    ['March 14, 1962', 'dob'],
    ['14 Mar 1962', 'dob'],
    ['date of birth is in chart', 'dob'],
    ['MRN: A12345', 'mrn'],
    ['record 00123456', 'mrn'],
    ['call (555) 123-4567', 'phone'],
    ['555.123.4567', 'phone'],
    ['+1 555 123 4567', 'phone'],
    ['123-45-6789', 'ssn'],
    ['pt@example.com', 'email'],
    ['lives at 42 Elm Street', 'address'],
    ['1600 Pennsylvania Ave', 'address'],
    ['Apt 4B', 'address'],
  ])('flags %j as %s', (text, kind) => {
    expect(kinds(text)).toContain(kind);
  });

  it.each([
    'Zorblax syndrome',
    "Murphy's sign",
    'BP 120/80, HR 110',
    'K 6.5, Na 128, glucose 450',
    'platelets 150,000',
    'give 2 L normal saline over 1 hour',
    'Dr. Courvoisier law: painless jaundice',
    'pt is septic, start broad-spectrum antibiotics',
    'troponin rise at 3 to 6 hours',
  ])('allows clinical text %j', (text) => {
    expect(detectPhi(text).blocked).toBe(false);
  });

  describe('names (patient log only)', () => {
    it('are off by default', () => {
      expect(kinds('Mr. Smith with DKA')).toEqual([]);
    });

    it('flags honorifics and "name is" when enabled', () => {
      expect(kinds('Mr. Smith with DKA', true)).toEqual(['name']);
      expect(kinds('patient name: Sarah', true)).toEqual(['name']);
      expect(kinds('pt is septic', true)).toEqual([]);
      expect(kinds('DKA', true)).toEqual([]);
    });
  });
});

describe('diagnosis-only fields (patient log)', () => {
  const log = (text: string): PhiKind[] => [
    ...new Set(
      detectPhi(text, { checkNames: true, diagnosisOnly: true }).findings.map((f) => f.kind),
    ),
  ];

  it.each<[string, PhiKind]>([
    ['DKA seen 3/14', 'date'],
    ['CHF 11-13', 'date'],
    ['pneumonia Nov 13', 'date'],
    ['pneumonia 13th November', 'date'],
    ['sepsis 123456', 'mrn'],
    ['Mr. Alvarez CHF exacerbation', 'name'],
  ])('flags %j as %s', (text, kind) => {
    expect(log(text)).toContain(kind);
  });

  it.each([
    'Diabetic ketoacidosis',
    'Type 2 diabetes',
    'Sepsis 3 criteria',
    'COPD exacerbation',
    'Stage 4 CKD',
    'Heart failure with reduced EF',
  ])('allows %j', (text) => {
    expect(log(text)).toEqual([]);
  });

  it('is off by default, so lab values and short numbers still pass elsewhere', () => {
    expect(detectPhi('platelets 150000 on 3/14').blocked).toBe(false);
  });

  it('reports a date of birth once, not also as a short date', () => {
    expect(detectPhi('DKA 3/14/62', { diagnosisOnly: true }).findings).toEqual([
      { kind: 'dob', match: '3/14/62', index: 4 },
    ]);
  });
});

describe('diagnosisPhiWarning', () => {
  it("uses the mockup's wording and names what to remove", () => {
    expect(diagnosisPhiWarning('Mr. Alvarez CHF exacerbation')).toBe(
      'This looks like a patient\'s name. Remove "Mr. Alvarez" and keep only the diagnosis.',
    );
    expect(diagnosisPhiWarning('DKA MRN 1234567')).toBe(
      'This looks like a medical record number. Remove "MRN 1234567" and keep only the diagnosis.',
    );
  });

  it('names the first problem in the text', () => {
    expect(diagnosisPhiWarning('3/14 Mrs. Lee pneumonia')).toBe(
      'This looks like a date. Remove "3/14" and keep only the diagnosis.',
    );
  });

  it('is null for a clean label', () => {
    expect(diagnosisPhiWarning('Heart failure exacerbation')).toBeNull();
    expect(diagnosisPhiWarning('')).toBeNull();
  });
});

describe('phiWarning', () => {
  it('describes what was found', () => {
    expect(phiWarning(detectPhi('DKA'))).toBeNull();
    expect(phiWarning(detectPhi('MRN 1234567, DOB 1/2/1990'))).toBe(
      'This looks like it contains a medical record number, a date of birth. Rounds never stores patient details. Remove it and try again.',
    );
  });
});
