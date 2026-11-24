/**
 * Flags text that looks like patient identifiers (CLAUDE.md domain rule 5).
 * Any finding blocks the input. This is a guard against slips, not a
 * de-identification tool: it errs toward blocking.
 */
export type PhiKind = 'dob' | 'date' | 'mrn' | 'phone' | 'ssn' | 'email' | 'address' | 'name';

export interface PhiFinding {
  kind: PhiKind;
  match: string;
  /** Where the match starts in the text. Findings are sorted by it. */
  index: number;
}

export interface PhiResult {
  blocked: boolean;
  findings: PhiFinding[];
}

export interface DetectPhiOptions {
  /**
   * Name detection. Off for pimp answers, where eponyms ("Murphy's sign",
   * "Dr. Courvoisier's law") would trigger false positives; on for the
   * patient log.
   */
  checkNames?: boolean;
  /**
   * Diagnosis-only fields (the patient log, wireframe 08 note 1). A diagnosis
   * label has no reason to hold numbers or dates, so this also flags any date
   * ("3/14", "Nov 13") and digit runs of 6 or more. Off elsewhere, where lab
   * values and blood pressures would trigger it.
   */
  diagnosisOnly?: boolean;
}

const MONTH =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

const PATTERNS: { kind: PhiKind; re: RegExp }[] = [
  { kind: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { kind: 'email', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  {
    kind: 'phone',
    re: /(?:\+?1[\s.-]?)?(?:\(\d{3}\)\s?|\b\d{3}[\s.-])\d{3}[\s.-]\d{4}\b/g,
  },
  // 03/14/1962, 3-14-62 (three parts, so blood pressures like 120/80 don't match)
  { kind: 'dob', re: /\b(?:0?[1-9]|1[0-2])[/-](?:0?[1-9]|[12]\d|3[01])[/-](?:\d{4}|\d{2})\b/g },
  // 1962-03-14
  { kind: 'dob', re: /\b(?:19|20)\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])\b/g },
  // March 14, 1962 / 14 Mar 1962
  { kind: 'dob', re: new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,2},?\\s+(?:19|20)\\d{2}\\b`, 'gi') },
  { kind: 'dob', re: new RegExp(`\\b\\d{1,2}\\s+${MONTH}\\.?,?\\s+(?:19|20)\\d{2}\\b`, 'gi') },
  { kind: 'dob', re: /\b(?:dob|d\.o\.b\.?|date of birth|born on)\b/gi },
  { kind: 'mrn', re: /\b(?:mrn|medical record(?: number| no\.?| #)?)\b[\s:#]*\w*/gi },
  // Long digit runs look like record numbers. Lab values rarely reach 7 digits.
  { kind: 'mrn', re: /\b\d{7,}\b/g },
  {
    kind: 'address',
    re: /\b\d{1,6}\s+(?:[a-z0-9]+\s+){1,3}(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|court|ct|way|place|pl|terrace|circle)\b\.?/gi,
  },
  { kind: 'address', re: /\b(?:apt|apartment|suite|unit)\s*#?\s*\d+\w?\b/gi },
];

const NAME_PATTERNS: RegExp[] = [
  // Mr. Smith, Mrs Jones, Ms. Lee
  /\b(?:[Mm](?:rs?|s|x)|[Mm]iss)\.?\s+[A-Z][a-z'-]+/g,
  // "patient name: ...", "pt is John", "named Sarah"
  // Case-sensitive on the name itself so "pt is septic" doesn't match.
  /\b(?:[Pp]atient(?:'s)? name|[Pp]t name|[Nn]ame is|[Nn]amed|[Pp]t is)\b\s*:?\s*[A-Z][a-z'-]+/g,
];

const DIAGNOSIS_ONLY_PATTERNS: { kind: PhiKind; re: RegExp }[] = [
  // 3/14, 03-14 (month first or day first; two parts)
  { kind: 'date', re: /\b\d{1,2}[/-]\d{1,2}\b/g },
  // Nov 13, 13 November
  { kind: 'date', re: new RegExp(`\\b${MONTH}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\b`, 'gi') },
  { kind: 'date', re: new RegExp(`\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\b`, 'gi') },
  { kind: 'mrn', re: /\b\d{6,}\b/g },
];

export function detectPhi(text: string, options: DetectPhiOptions = {}): PhiResult {
  const findings: PhiFinding[] = [];

  const patterns = [
    ...PATTERNS,
    ...(options.diagnosisOnly ? DIAGNOSIS_ONLY_PATTERNS : []),
    ...(options.checkNames ? NAME_PATTERNS.map((re) => ({ kind: 'name' as const, re })) : []),
  ];
  for (const { kind, re } of patterns) {
    for (const match of text.matchAll(re)) {
      // A span already reported (a DOB that is also a short date) is reported once.
      if (findings.some((f) => f.index <= match.index && match.index < f.index + f.match.length)) {
        continue;
      }
      findings.push({ kind, match: match[0].trim(), index: match.index });
    }
  }
  findings.sort((a, b) => a.index - b.index);

  return { blocked: findings.length > 0, findings };
}

const KIND_LABEL: Record<PhiKind, string> = {
  dob: 'a date of birth',
  date: 'a date',
  mrn: 'a medical record number',
  phone: 'a phone number',
  ssn: 'a Social Security number',
  email: 'an email address',
  address: 'an address',
  name: "a patient's name",
};

/** A user-facing warning for blocked input. */
export function phiWarning(result: PhiResult): string | null {
  if (!result.blocked) return null;
  const kinds = [...new Set(result.findings.map((f) => KIND_LABEL[f.kind]))];
  return `This looks like it contains ${kinds.join(', ')}. PimpMe never stores patient details. Remove it and try again.`;
}

/**
 * The patient log's check (wireframe 08 note 1): names, dates, record numbers
 * and the rest, with a warning that says exactly what to remove, in the
 * mockup's words: 'This looks like a patient's name. Remove "Mr. Alvarez" and
 * keep only the diagnosis.' Null when the label is fine.
 */
export function diagnosisPhiWarning(label: string): string | null {
  const [first] = detectPhi(label, { checkNames: true, diagnosisOnly: true }).findings;
  if (!first) return null;
  return `This looks like ${KIND_LABEL[first.kind]}. Remove "${first.match}" and keep only the diagnosis.`;
}
