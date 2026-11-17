/**
 * Reads Open Graph and Twitter Card meta tags from a parsed document. The
 * document is described structurally so the logic needs no webhint types and
 * can be tested with any DOM that offers `querySelectorAll`.
 */

/** The slice of a DOM element this module needs. */
export interface MetaElement {
  getAttribute(name: string): string | null;
}

/** The slice of a DOM document this module needs. */
export interface MetaDocument<E extends MetaElement = MetaElement> {
  querySelectorAll(selector: string): Iterable<E>;
}

/**
 * Returns every meta tag that carries a non-empty value for the key, in
 * document order. Open Graph tags use `property="og:*"` while Twitter tags use
 * `name="twitter:*"`, but sites mix the two freely, so both attributes are
 * accepted for every key.
 */
function metaElements<E extends MetaElement>(
  parsedDocument: MetaDocument<E>,
  key: string,
): E[] {
  const wanted = key.toLowerCase();
  return [...parsedDocument.querySelectorAll('meta')].filter((meta) => {
    // A tag may carry both attributes (for example property="og:title" name="title"), so match either one.
    const names = [
      meta.getAttribute('property'),
      meta.getAttribute('name'),
    ].map((attribute) => (attribute ?? '').trim().toLowerCase());
    const content = meta.getAttribute('content');
    return names.includes(wanted) && content !== null && content.trim() !== '';
  });
}

/** Returns every non-empty value of a meta tag, in document order. */
export function metaValues(
  parsedDocument: MetaDocument,
  key: string,
): string[] {
  return metaElements(parsedDocument, key).map((meta) =>
    (meta.getAttribute('content') ?? '').trim(),
  );
}

/** Returns the first non-empty value of a meta tag, or null when absent. */
export function metaValue(
  parsedDocument: MetaDocument,
  key: string,
): string | null {
  return metaValues(parsedDocument, key)[0] ?? null;
}

/** Returns the first meta tag with a non-empty value for the key, or null. */
export function metaElement<E extends MetaElement>(
  parsedDocument: MetaDocument<E>,
  key: string,
): E | null {
  return metaElements(parsedDocument, key)[0] ?? null;
}
