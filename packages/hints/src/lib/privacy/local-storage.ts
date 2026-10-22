/** One `localStorage` entry. */
export interface StorageEntry {
  key: string;
  value: string;
}

/** Webbkoll truncates keys and values to this many characters. */
const TRUNCATE_AT = 50;

const segmenter = new Intl.Segmenter();

/**
 * Shortens a string to `maximum` characters, adding `...` when cut. Like
 * Webbkoll's `String.length` and `String.slice`, it counts what a reader sees
 * as one character (a whole emoji or accented letter), so a cut never splits
 * one in half.
 */
export function truncate(value: string, maximum: number = TRUNCATE_AT): string {
  const characters = Array.from(segmenter.segment(value), (s) => s.segment);
  return characters.length > maximum
    ? `${characters.slice(0, maximum).join('')}...`
    : value;
}

/**
 * Turns what the browser returned for the storage dump into entries. The
 * dump is a JSON string or an object of key/value pairs; anything else, or
 * an unreadable value, means storage is not used.
 */
export function parseStorage(raw: unknown): StorageEntry[] {
  let data: unknown = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return [];
  }
  return Object.entries(data as Record<string, unknown>).map(
    ([key, value]) => ({ key, value: String(value) }),
  );
}
