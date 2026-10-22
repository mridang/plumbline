/**
 * Readers that pull syndication- and discovery-related `<link>` elements out
 * of a parsed HTML document. Like the SEO readers, they only need the tiny
 * slice of the DOM described below, so they can be unit tested without running
 * a scan and can be driven from Lighthouse artifacts just as easily as from
 * webhint's live document.
 *
 * Each reader returns the links it found as plain {@link DiscoveredLink}
 * values, so the single-source rule functions in `checks.ts` work on data, not
 * on DOM nodes.
 */

/** The part of a DOM element these readers use. */
interface ElementLike {
  getAttribute(name: string): string | null;
}

/** The part of a DOM document these readers use. */
export interface DocumentLike {
  querySelectorAll(selector: string): ElementLike[];
}

/** A `<link>` element reduced to the attributes discovery cares about. */
export interface DiscoveredLink {
  /** The lower-cased, trimmed `type` attribute, or an empty string. */
  type: string;
  /** The raw, trimmed `href` attribute, or an empty string. */
  href: string;
}

/** The feed MIME types RSS/Atom autodiscovery uses. */
export const FEED_TYPES = [
  'application/rss+xml',
  'application/atom+xml',
] as const;

/** The oEmbed discovery MIME types (oembed.com, "Discovery"). */
export const OEMBED_TYPES = [
  'application/json+oembed',
  'text/xml+oembed',
] as const;

/** The OpenSearch description document MIME type. */
export const OPENSEARCH_TYPE = 'application/opensearchdescription+xml';

/** Turns a `<link>` element into a {@link DiscoveredLink}. */
function toLink(element: ElementLike): DiscoveredLink {
  return {
    type: (element.getAttribute('type') ?? '').trim().toLowerCase(),
    href: (element.getAttribute('href') ?? '').trim(),
  };
}

/**
 * Returns every `<link rel="alternate">` whose `type` is an RSS or Atom feed
 * type. The `rel~=` match accepts a multi-valued `rel` such as
 * `rel="alternate home"`, which is valid HTML.
 */
export function getFeedLinks(doc: DocumentLike): DiscoveredLink[] {
  return doc
    .querySelectorAll('link[rel~="alternate" i][type]')
    .map(toLink)
    .filter((link) => (FEED_TYPES as readonly string[]).includes(link.type));
}

/**
 * Returns every `<link rel="alternate">` whose `type` is an oEmbed type
 * (`application/json+oembed` or `text/xml+oembed`).
 */
export function getOembedLinks(doc: DocumentLike): DiscoveredLink[] {
  return doc
    .querySelectorAll('link[rel~="alternate" i][type]')
    .map(toLink)
    .filter((link) => (OEMBED_TYPES as readonly string[]).includes(link.type));
}

/**
 * Returns every `<link rel="search">` whose `type` is the OpenSearch
 * description type.
 */
export function getOpenSearchLinks(doc: DocumentLike): DiscoveredLink[] {
  return doc
    .querySelectorAll('link[rel~="search" i][type]')
    .map(toLink)
    .filter((link) => link.type === OPENSEARCH_TYPE);
}
