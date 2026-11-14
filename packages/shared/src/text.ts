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

// prettier-ignore
const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7',
  eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', thirteen: '13', fourteen: '14',
  fifteen: '15', sixteen: '16', seventeen: '17', eighteen: '18', nineteen: '19', twenty: '20',
  thirty: '30', forty: '40', fifty: '50', sixty: '60', seventy: '70', eighty: '80', ninety: '90',
  hundred: '100',
};
/** Spoken fillers the speech-to-text writes down ("um, the ALT"). */
const FILLERS = new Set(['um', 'umm', 'uh', 'uhh', 'uhm', 'er', 'erm', 'hmm', 'mm']);

/**
 * Normalized words for matching. Both sides of every match go through this,
 * so spoken answers compare like typed ones: number words read as digits
 * ("three times" = "3 times") and fillers drop out.
 */
function matchWords(text: string): string[] {
  const words = normalize(text).split(' ');
  return words.filter((w) => w !== '' && !FILLERS.has(w)).map((w) => NUMBER_WORDS[w] ?? w);
}

/** True if `term` appears in `text` as a whole-word sequence (both normalized). */
export function containsTerm(text: string, term: string): boolean {
  const t = matchWords(term).join(' ');
  if (!t) return false;
  return ` ${matchWords(text).join(' ')} `.includes(` ${t} `);
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

/** A matched run of words, as [start, end) word indexes into the normalized text. */
export type Span = readonly [number, number];

/**
 * Where `term` appears in `text`, skipping occurrences that a nearby word
 * negates ("not a CT angiogram" does not affirm "CT angiogram"). A term that
 * itself starts with "no" ("no P waves") is fine: only the words before it
 * are checked.
 */
export function affirmedSpans(text: string, term: string): Span[] {
  const t = matchWords(term);
  if (t.length === 0) return [];
  const words = matchWords(text);
  const spans: Span[] = [];
  for (let i = 0; i + t.length <= words.length; i++) {
    if (t.every((w, j) => words[i + j] === w)) {
      if (!negated(words.slice(Math.max(0, i - NEGATION_WINDOW), i))) spans.push([i, i + t.length]);
    }
  }
  return spans;
}

/** True if `term` appears in `text` at least once without being negated. */
export function containsAffirmedTerm(text: string, term: string): boolean {
  return affirmedSpans(text, term).length > 0;
}
