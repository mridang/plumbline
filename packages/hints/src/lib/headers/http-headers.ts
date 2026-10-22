/** A header bag as webhint exposes it: values may be strings or arrays. */
export type HeaderBag = Record<string, string | string[] | undefined>;

/**
 * Returns every value of a header, looked up case-insensitively. Repeated
 * headers (an array) are returned as separate values and are not joined, so
 * callers can tell "sent twice" from "sent once with a comma".
 */
export function headerValues(
  headers: HeaderBag | undefined,
  name: string,
): string[] {
  if (!headers) {
    return [];
  }
  const wanted = name.toLowerCase();
  const found: string[] = [];
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== wanted || value === undefined) {
      continue;
    }
    found.push(...(Array.isArray(value) ? value : [String(value)]));
  }
  return found;
}

/**
 * Splits a comma separated header value into its trimmed, non-empty members.
 * Used for the many list-shaped headers (CORS method/header lists, client-hint
 * token lists, `Vary`, timing origins) where order does not matter and empty
 * entries are noise.
 */
export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
}

/** Returns the first value of a header, trimmed, or null when absent. */
export function firstHeader(
  headers: HeaderBag | undefined,
  name: string,
): string | null {
  const [first] = headerValues(headers, name);
  return first === undefined ? null : first.trim();
}

/** The part of a document these checks need: a way to select elements. */
export interface QueryableDocument {
  querySelectorAll(selector: string): Iterable<{
    getAttribute(name: string): string | null;
  }>;
}

/**
 * Returns every `<meta>` whose `attribute` equals `value` (compared
 * case-insensitively), in document order.
 */
export function metaElements<
  E extends { getAttribute(name: string): string | null },
>(
  document: { querySelectorAll(selector: string): Iterable<E> },
  attribute: 'http-equiv' | 'name',
  value: string,
): E[] {
  return [...document.querySelectorAll(`meta[${attribute}]`)].filter(
    (meta) => meta.getAttribute(attribute)?.trim().toLowerCase() === value,
  );
}

/** Returns the `content` of every `<meta>` found by `metaElements`. */
export function metaContents(
  document: QueryableDocument,
  attribute: 'http-equiv' | 'name',
  value: string,
): string[] {
  return metaElements(document, attribute, value).map(
    (meta) => meta.getAttribute('content') ?? '',
  );
}
