/**
 * Webmention (W3C Recommendation) lets one site notify another that it links to
 * it. A receiver advertises its endpoint with `<link rel="webmention">` or a
 * `Link: <...>; rel="webmention"` header. The check reports the endpoint when
 * present and warns when it is missing a target or is not an absolute URL,
 * since a relative endpoint is ambiguous for the senders that read it.
 *
 * Source: W3C Webmention (https://www.w3.org/TR/webmention/).
 */
import { finding, type Finding } from '../headers/finding.js';
import { isAbsoluteUrl, withRel, type RelLink } from './links.js';

/**
 * Evaluates the Webmention endpoint of a page.
 *
 * @param links every relation link found in the DOM and `Link` header.
 */
export function webmentionFindings(links: readonly RelLink[]): Finding[] {
  const endpoints = withRel(links, 'webmention');
  if (endpoints.length === 0) {
    return [];
  }
  const usable = endpoints.filter(
    (endpoint) => endpoint.href !== '' && isAbsoluteUrl(endpoint.href),
  );
  if (usable.length === 0) {
    return [
      finding(
        'warning',
        `The Webmention endpoint must be an absolute URL, not '${endpoints[0]?.href ?? ''}'.`,
      ),
    ];
  }
  return [
    finding(
      'hint',
      `The page advertises a Webmention endpoint (${usable[0]?.href ?? ''}).`,
    ),
  ];
}
