/** Text helpers for the Open Graph title and description rules. */

/** Counts characters the way a reader does (code points, not UTF-16 units). */
export function charLength(text: string): number {
  return [...text].length;
}

/** True when the text starts with an `http://` or `https://` URL. */
export function startsWithUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim());
}

/** Collapses case and whitespace so two texts can be compared. */
export function normalizeText(text: string): string {
  return text.trim().replaceAll(/\s+/g, ' ').toLowerCase();
}

/** Words that are naturally repeated and never count as stuffing. */
const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'you',
  'your',
  'are',
  'that',
  'this',
  'from',
  'our',
  'all',
  'can',
  'not',
  'but',
  'has',
  'have',
  'was',
  'were',
  'will',
]);

/**
 * Detects keyword stuffing: the same word repeated excessively. The article
 * gives no numbers, so a word of three or more letters (not a stop word) is
 * stuffed when it appears four or more times, or three times when it makes
 * up more than 30% of a description of at least six words.
 */
export function hasKeywordStuffing(text: string): boolean {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const counts = new Map<string, number>();
  for (const word of words) {
    if (word.length >= 3 && !STOP_WORDS.has(word)) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  for (const count of counts.values()) {
    if (count >= 4) {
      return true;
    }
    if (count >= 3 && words.length >= 6 && count / words.length > 0.3) {
      return true;
    }
  }
  return false;
}
