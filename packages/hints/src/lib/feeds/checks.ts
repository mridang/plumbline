/**
 * Single-source DOM-discovery rules for the `feeds` set. Each rule is a pure
 * function that reads the page through the `read.ts` helpers and returns a
 * {@link Finding}[] (empty when the page passes). Both callers share them so
 * the message text and severity can never drift:
 *
 *   - the webhint hints (`src/hints/feeds/<id>.ts`) turn a finding into a
 *     `context.report(...)`, adding only the DOM detail (the offending
 *     `<link>` element, or a suggested snippet) that needs the live document;
 *   - the Lighthouse checks (`lighthouse/src/checks/feeds.ts`) return the
 *     findings as-is.
 *
 * Discovery is deliberately informative: a page is not *wrong* for having no
 * feed, oEmbed or OpenSearch link, so the absence is reported at `hint` level.
 * What *is* a defect is a discovered link that cannot be used — a feed or
 * OpenSearch `<link>` with a missing or non-absolute `href` — so that is a
 * `warning`. The "is the linked document actually valid?" question needs a
 * fetch and lives in `validate.ts`, driven only by the webhint `*-valid` hints.
 */
import { finding, type Finding } from '../headers/finding.js';
import { isAbsoluteUrl } from '../files/issue.js';
import {
  getFeedLinks,
  getOembedLinks,
  getOpenSearchLinks,
  type DocumentLike,
} from './read.js';

// ---- Reference links (shared with each hint's `reference` metadata) --------
/** RSS 2.0 autodiscovery, as defined by the RSS Advisory Board. */
export const FEED_DISCOVERY_REF = 'https://www.rssboard.org/rss-autodiscovery';
/** OEmbed discovery, as defined by the oEmbed specification. */
export const OEMBED_DISCOVERY_REF = 'https://oembed.com/#section4';
/** OpenSearch autodiscovery, as defined by the OpenSearch specification. */
export const OPENSEARCH_DISCOVERY_REF =
  'https://github.com/dewitt/opensearch/blob/master/opensearch-1-1-draft-6.md#autodiscovery';

/**
 * Reports the feed-autodiscovery state of a page. When no RSS/Atom feed link
 * is declared, a `hint` records it; when a feed link is declared but its
 * `href` is missing or not an absolute URL, a `warning` is returned because a
 * relative or empty feed URL cannot be resolved by most feed readers, which
 * fetch it out of the page's context.
 */
export function feedDiscovery(doc: DocumentLike): Finding[] {
  const links = getFeedLinks(doc);
  if (links.length === 0) {
    return [
      finding(
        'hint',
        'No RSS or Atom feed is advertised with <link rel="alternate" type="application/rss+xml"> or "application/atom+xml".',
      ),
    ];
  }
  return links
    .filter((link) => !isAbsoluteUrl(link.href))
    .map((link) =>
      finding(
        'warning',
        link.href === ''
          ? 'A feed <link> has no href; the feed URL is required and must be absolute.'
          : `The feed <link> href '${link.href}' is not an absolute URL; feed autodiscovery requires an absolute URL.`,
      ),
    );
}

/**
 * Reports the oEmbed-discovery state of a page. OEmbed consumers look for a
 * `<link rel="alternate" type="application/json+oembed">` (or the XML variant)
 * whose `href` is the oEmbed endpoint for the page. Absence is informational;
 * a declared link with a missing `href` is a `warning` (the endpoint URL is
 * mandatory). OEmbed permits a relative `href`, so only an empty one is flagged.
 */
export function oembedDiscovery(doc: DocumentLike): Finding[] {
  const links = getOembedLinks(doc);
  if (links.length === 0) {
    return [
      finding(
        'hint',
        'No oEmbed endpoint is advertised with <link rel="alternate" type="application/json+oembed"> or "text/xml+oembed".',
      ),
    ];
  }
  return links
    .filter((link) => link.href === '')
    .map(() =>
      finding(
        'warning',
        'An oEmbed <link> has no href; the oEmbed endpoint URL is required.',
      ),
    );
}

/**
 * Reports the OpenSearch-discovery state of a page. A site that offers search
 * advertises its description document with
 * `<link rel="search" type="application/opensearchdescription+xml" href=...>`.
 * Absence is informational; a declared link with a missing or non-absolute
 * `href` is a `warning`, since the browser resolves and fetches the
 * description document from that URL.
 */
export function opensearchDiscovery(doc: DocumentLike): Finding[] {
  const links = getOpenSearchLinks(doc);
  if (links.length === 0) {
    return [
      finding(
        'hint',
        'No OpenSearch description is advertised with <link rel="search" type="application/opensearchdescription+xml">.',
      ),
    ];
  }
  return links
    .filter((link) => !isAbsoluteUrl(link.href))
    .map((link) =>
      finding(
        'warning',
        link.href === ''
          ? 'An OpenSearch <link> has no href; the description document URL is required and must be absolute.'
          : `The OpenSearch <link> href '${link.href}' is not an absolute URL.`,
      ),
    );
}
