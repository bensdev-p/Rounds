import { describe, expect, it } from 'vitest';
import { detectPhi, phiWarning, type PhiKind } from './detectPhi';

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

describe('phiWarning', () => {
  it('describes what was found', () => {
    expect(phiWarning(detectPhi('DKA'))).toBeNull();
    expect(phiWarning(detectPhi('MRN 1234567, DOB 1/2/1990'))).toBe(
      'This looks like it contains a date of birth, a medical record number. Rounds never stores patient details. Remove it and try again.',
    );
  });
});
