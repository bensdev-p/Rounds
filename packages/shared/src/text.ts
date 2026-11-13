/**
 * Normalizes free text for comparison: lowercase, strip diacritics and
 * punctuation, collapse whitespace, drop a leading article.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/^(?:a|an|the) /, '');
}

/** True if `term` appears in `text` as a whole-word sequence (both normalized). */
export function containsTerm(text: string, term: string): boolean {
  const t = normalize(term);
  if (!t) return false;
  return ` ${normalize(text)} `.includes(` ${t} `);
}

/** Words that negate what follows ("not", "no", "without"…). Apostrophes normalize away. */
const NEGATORS = new Set(['not', 'no', 'never', 'without', 'nor', 'neither', 'instead', 'rather']);
/** "isn't" normalizes to "isn t": a "t" after one of these is a negation. */
const CONTRACTIONS = new Set([
  'isn', 'aren', 'wasn', 'weren', 'don', 'doesn', 'didn', 'won', 'wouldn', 'can', 'couldn', 'shouldn',
]);
/** How many words before a term are checked for a negation. */
const NEGATION_WINDOW = 4;

function negated(before: readonly string[]): boolean {
  return before.some((word, i) => {
    if (NEGATORS.has(word)) return true;
    if (word === 't' && i > 0 && CONTRACTIONS.has(before[i - 1] ?? '')) return true;
    // "rule out X", "ruled out X"
    return word === 'out' && (before[i - 1] === 'rule' || before[i - 1] === 'ruled');
  });
}

/**
 * Like `containsTerm`, but ignores an occurrence that a nearby word negates:
 * "not a CT angiogram" does not affirm "CT angiogram". True if any occurrence
 * stands un-negated. A term that itself starts with "no" ("no P waves") is
 * fine: only the words before it are checked.
 */
export function containsAffirmedTerm(text: string, term: string): boolean {
  const t = normalize(term).split(' ');
  if (t[0] === '') return false;
  const words = normalize(text).split(' ');
  for (let i = 0; i + t.length <= words.length; i++) {
    if (t.every((w, j) => words[i + j] === w)) {
      if (!negated(words.slice(Math.max(0, i - NEGATION_WINDOW), i))) return true;
    }
  }
  return false;
}
