/**
 * Validators for the documents the discovery `<link>`s point at. These run
 * only inside the webhint `*-valid` hints, which fetch the linked feed or
 * OpenSearch description after the scan; a DOM-only plugin cannot make that
 * request, so there is no Lighthouse counterpart. Each validator is a pure
 * function over the fetched text and returns a {@link Finding}[] (empty when
 * the document is well-formed), so it is unit tested without any network.
 *
 * The rules are faithful to the three specifications:
 *   - RSS 2.0 (RSS Advisory Board): a `<rss>` root whose `<channel>` carries
 *     the required `<title>`, `<link>` and `<description>`.
 *   - Atom 1.0 (RFC 4287): a `<feed>` root carrying the required `<id>`,
 *     `<title>` and `<updated>`.
 *   - OpenSearch 1.1 (OpenSearch specification): an `<OpenSearchDescription>`
 *     root carrying `<ShortName>` (at most 16 characters) and at least one
 *     `<Url>` with a `template` attribute.
 */
import { finding, type Finding } from '../headers/finding.js';
import { childByName, descendantsByName, parseXml } from './xml.js';

/** RSS 2.0, as published by the RSS Advisory Board. */
export const FEED_VALID_RSS_REF = 'https://www.rssboard.org/rss-specification';
/** OpenSearch 1.1 description document. */
export const OPENSEARCH_VALID_REF =
  'https://github.com/dewitt/opensearch/blob/master/opensearch-1-1-draft-6.md';

/** True when `element` has a direct child of `name` whose text is non-empty. */
function hasText(element: ReturnType<typeof parseXml>, name: string): boolean {
  if (!element) {
    return false;
  }
  const child = childByName(element, name);
  return child !== null && child.text !== '';
}

/**
 * Validates a fetched feed body. The root element decides whether RSS 2.0 or
 * Atom 1.0 rules apply; anything else (including unparsable XML) is a single
 * `error`, since it is not a feed a reader can consume.
 */
export function validateFeed(text: string): Finding[] {
  const root = parseXml(text);
  if (!root) {
    return [finding('error', 'The feed is not well-formed XML.')];
  }
  if (root.localName === 'rss') {
    return validateRss(text);
  }
  if (root.localName === 'feed') {
    return validateAtom(text);
  }
  return [
    finding(
      'error',
      `The feed root element is <${root.name}>; a feed must be <rss> (RSS 2.0) or <feed> (Atom 1.0).`,
    ),
  ];
}

/** Validates an RSS 2.0 body (root already known to be `<rss>`). */
function validateRss(text: string): Finding[] {
  const root = parseXml(text);
  const channel = root ? childByName(root, 'channel') : null;
  if (!channel) {
    return [finding('error', 'The RSS feed has no <channel> element.')];
  }
  const findings: Finding[] = [];
  for (const required of ['title', 'link', 'description'] as const) {
    if (!hasText(channel, required)) {
      findings.push(
        finding(
          'error',
          `The RSS <channel> is missing the required <${required}> element.`,
        ),
      );
    }
  }
  return findings;
}

/** Validates an Atom 1.0 body (root already known to be `<feed>`). */
function validateAtom(text: string): Finding[] {
  const root = parseXml(text);
  if (!root) {
    return [finding('error', 'The Atom feed is not well-formed XML.')];
  }
  const findings: Finding[] = [];
  for (const required of ['id', 'title', 'updated'] as const) {
    if (!hasText(root, required)) {
      findings.push(
        finding(
          'error',
          `The Atom <feed> is missing the required <${required}> element.`,
        ),
      );
    }
  }
  return findings;
}

/**
 * Validates a fetched OpenSearch description document. It must be a well-formed
 * `<OpenSearchDescription>` carrying a `<ShortName>` of at most 16 characters
 * and at least one `<Url>` element with a `template` attribute.
 */
export function validateOpenSearch(text: string): Finding[] {
  const root = parseXml(text);
  if (!root) {
    return [
      finding('error', 'The OpenSearch description is not well-formed XML.'),
    ];
  }
  if (root.localName !== 'opensearchdescription') {
    return [
      finding(
        'error',
        `The OpenSearch root element is <${root.name}>; it must be <OpenSearchDescription>.`,
      ),
    ];
  }
  const findings: Finding[] = [];
  const shortName = childByName(root, 'shortname');
  if (!shortName || shortName.text === '') {
    findings.push(
      finding(
        'error',
        'The OpenSearch description is missing the required <ShortName> element.',
      ),
    );
  } else if (shortName.text.length > 16) {
    findings.push(
      finding(
        'error',
        `The OpenSearch <ShortName> must be 16 characters or fewer; it is ${shortName.text.length}.`,
      ),
    );
  }
  const urls = descendantsByName(root, 'url');
  if (!urls.some((url) => (url.attrs['template'] ?? '').trim() !== '')) {
    findings.push(
      finding(
        'error',
        'The OpenSearch description has no <Url> element with a template attribute.',
      ),
    );
  }
  return findings;
}
