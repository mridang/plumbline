/**
 * Reads Open Graph and Twitter Card meta tags from a parsed document. The
 * document is described structurally so the logic needs no webhint types and
 * can be tested with any DOM that offers `querySelectorAll`.
 */

/** The slice of a DOM element this module needs. */
interface MetaElement {
  getAttribute(name: string): string | null;
}

/** The slice of a DOM document this module needs. */
export interface MetaDocument {
  querySelectorAll(selector: string): Iterable<MetaElement>;
}

/**
 * Returns every non-empty value of a meta tag, in document order. Open Graph
 * tags use `property="og:*"` while Twitter tags use `name="twitter:*"`, but
 * sites mix the two freely, so both attributes are accepted for every key.
 */
export function metaValues(doc: MetaDocument, key: string): string[] {
  const wanted = key.toLowerCase();
  const values: string[] = [];
  for (const meta of doc.querySelectorAll('meta')) {
    // A tag may carry both attributes (for example property="og:title" name="title"), so match either one.
    const names = [
      meta.getAttribute('property'),
      meta.getAttribute('name'),
    ].map((attr) => (attr ?? '').trim().toLowerCase());
    const content = meta.getAttribute('content');
    if (names.includes(wanted) && content !== null && content.trim() !== '') {
      values.push(content.trim());
    }
  }
  return values;
}

/** Returns the first non-empty value of a meta tag, or null when absent. */
export function metaValue(doc: MetaDocument, key: string): string | null {
  return metaValues(doc, key)[0] ?? null;
}
