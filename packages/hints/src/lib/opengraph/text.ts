/** Matches an `http://` or `https://` prefix. */
const HTTP_OR_HTTPS_PREFIX = /^https?:\/\//iu;
/** Text helpers for the Open Graph title and description rules. */

/** Counts characters the way a reader does (code points, not UTF-16 units). */
export function charLength(text: string): number {
  return text.match(/./gsu)?.length ?? 0;
}

/** True when the text starts with an `http://` or `https://` URL. */
export function startsWithUrl(text: string): boolean {
  return HTTP_OR_HTTPS_PREFIX.test(text.trim());
}

/** Collapses case and whitespace so two texts can be compared. */
export function normalizeText(text: string): string {
  return text.trim().replaceAll(/\s+/gu, ' ').toLowerCase();
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
  const groups = Map.groupBy(
    words.filter((word) => word.length >= 3 && !STOP_WORDS.has(word)),
    (word) => word,
  );
  return [...groups.values()].some(
    ({ length: count }) =>
      count >= 4 ||
      (count >= 3 && words.length >= 6 && count / words.length > 0.3),
  );
}
