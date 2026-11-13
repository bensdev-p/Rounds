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
