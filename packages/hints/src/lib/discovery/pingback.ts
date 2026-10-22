/**
 * Pingback is the predecessor of Webmention: a site advertises an XML-RPC
 * pingback server with `<link rel="pingback">` or an `X-Pingback` response
 * header. Pingback is largely obsolete and its open XML-RPC endpoint is a
 * well-known spam and SSRF/DDoS vector, so the check reports it as legacy when
 * present and recommends Webmention instead.
 *
 * Source: the Pingback 1.0 specification (https://www.hixie.ch/specs/pingback/pingback).
 */
import { finding, type Finding } from '../headers/finding.js';
import { withRel, type RelLink } from './links.js';

/**
 * Evaluates the Pingback advertisement of a page.
 *
 * @param links every relation link found in the DOM and `Link` header.
 * @param xPingback the `X-Pingback` response header value, or null.
 */
export function pingbackFindings(
  links: readonly RelLink[],
  xPingback: string | null,
): Finding[] {
  const present = withRel(links, 'pingback').length > 0 || xPingback !== null;
  if (!present) {
    return [];
  }
  return [
    finding(
      'warning',
      'A Pingback endpoint is advertised; Pingback is a legacy XML-RPC protocol and a known spam and amplification vector. Prefer Webmention.',
    ),
  ];
}
