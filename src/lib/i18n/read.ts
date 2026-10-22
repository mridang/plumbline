/**
 * Readers and validators that pull internationalisation link relations out of
 * a parsed HTML document: the `hreflang` alternates, the `rel="alternate"`
 * media links, and the `rel="prev"`/`rel="next"` pagination links. They read
 * only the tiny slice of the DOM described below, so they can be unit tested
 * without running a scan and are shared verbatim by the webhint hints and the
 * Lighthouse checks.
 *
 * The readers are generic over the element type so that a caller passing a real
 * webhint/`@hint/utils-dom` document gets back the concrete elements (ready to
 * hand to `context.report`), while the pure rule functions in `checks.ts` call
 * them with the minimal {@link ElementLike} and never touch the element.
 */

/** The part of a DOM element these readers use. */
export interface ElementLike {
  getAttribute(name: string): string | null;
}

/** The part of a DOM document these readers use. */
export interface DocumentLike {
  querySelectorAll(selector: string): ElementLike[];
}

/** A document whose `querySelectorAll` yields a specific element type. */
interface TypedDocument<E extends ElementLike> {
  querySelectorAll(selector: string): E[];
}

/** One `<link rel="alternate" hreflang="…">` entry, with its source element. */
export interface HreflangLink<E extends ElementLike = ElementLike> {
  /** The raw `hreflang` value, trimmed (for example `en-US` or `x-default`). */
  hreflang: string;
  /** The raw `href` value, trimmed (empty when the attribute is absent). */
  href: string;
  /** The element the entry came from, for a report to point at. */
  element: E;
}

/** One `<link rel="alternate" media="…">` entry, with its source element. */
export interface AlternateMediaLink<E extends ElementLike = ElementLike> {
  /** The raw `media` query, trimmed. */
  media: string;
  /** The raw `href` value, trimmed. */
  href: string;
  element: E;
}

/** One `<link rel="prev">` or `<link rel="next">` entry, with its source element. */
export interface PaginationLink<E extends ElementLike = ElementLike> {
  /** Which relation the link declares. */
  rel: 'prev' | 'next';
  /** The raw `href` value, trimmed. */
  href: string;
  element: E;
}

/**
 * Returns every `<link rel="alternate" hreflang="…">`, in document order. A
 * `rel` with several tokens (for example `alternate stylesheet`) still counts
 * as long as it contains the `alternate` token.
 */
export function getHreflangLinks<E extends ElementLike>(
  doc: TypedDocument<E>,
): HreflangLink<E>[] {
  return doc
    .querySelectorAll('link[rel~="alternate" i][hreflang]')
    .map((element) => ({
      hreflang: (element.getAttribute('hreflang') ?? '').trim(),
      href: (element.getAttribute('href') ?? '').trim(),
      element,
    }));
}

/**
 * Returns every `<link rel="alternate" media="…">`, in document order. These
 * point at a variant of the page for a given media query, such as a separate
 * mobile URL.
 */
export function getAlternateMediaLinks<E extends ElementLike>(
  doc: TypedDocument<E>,
): AlternateMediaLink<E>[] {
  return doc
    .querySelectorAll('link[rel~="alternate" i][media]')
    .map((element) => ({
      media: (element.getAttribute('media') ?? '').trim(),
      href: (element.getAttribute('href') ?? '').trim(),
      element,
    }));
}

/** Returns every `<link rel="prev">` and `<link rel="next">`, in document order. */
export function getPaginationLinks<E extends ElementLike>(
  doc: TypedDocument<E>,
): PaginationLink<E>[] {
  const prev = doc
    .querySelectorAll('link[rel~="prev" i]')
    .map((element) => ({ rel: 'prev' as const, element }));
  const next = doc
    .querySelectorAll('link[rel~="next" i]')
    .map((element) => ({ rel: 'next' as const, element }));
  return [...prev, ...next].map(({ rel, element }) => ({
    rel,
    href: (element.getAttribute('href') ?? '').trim(),
    element,
  }));
}

/**
 * Validates an `hreflang` value structurally: a two-letter ISO 639-1 language,
 * optionally followed by a two-letter ISO 3166-1 alpha-2 region
 * (`en`, `en-US`), or the literal `x-default`. Matching is case-insensitive, as
 * Google treats `hreflang` values. This is a structural check only: it does not
 * verify the code against the full ISO registries (that would need a data
 * table), but it rejects the mistakes that actually occur, such as `en_US`
 * (underscore), `eng` (three letters), a bare region, or a language name.
 */
export function isValidHreflang(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === 'x-default') {
    return true;
  }
  return /^[a-z]{2}(-[a-z]{2})?$/i.test(trimmed);
}

/**
 * True when `href` is an absolute, fully-qualified `http`/`https` URL. A
 * relative URL, a protocol-relative URL (`//host/path`), a `mailto:` or any
 * other scheme, and an unparsable value all return false. Google requires
 * fully-qualified URLs in `hreflang` and pagination links so that reciprocal
 * "return" links resolve.
 */
export function isAbsoluteHttpUrl(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Compares two URLs for equality, resolving `candidate` against `base` so a
 * relative value is handled, and ignoring the fragment. Returns false when
 * either side cannot be parsed.
 */
export function sameUrl(candidate: string, base: string): boolean {
  try {
    const a = new URL(candidate, base);
    const b = new URL(base);
    a.hash = '';
    b.hash = '';
    return a.href === b.href;
  } catch {
    return false;
  }
}
