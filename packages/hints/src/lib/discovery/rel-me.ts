/**
 * `rel=me` links are the IndieWeb identity mechanism: a page links to the
 * author's other profiles with `rel="me"`, and those profiles link back, so a
 * verifier can confirm the same person owns both. The check reports the
 * identity links found (information) and warns about a `rel=me` link with no
 * target, which cannot be verified.
 *
 * Source: the IndieWeb rel-me specification (https://microformats.org/wiki/rel-me).
 */
import { finding, type Finding } from '../headers/finding.js';
import { withRel, type RelLink } from './links.js';

/**
 * Evaluates the `rel=me` links of a page.
 *
 * @param links every relation link found in the DOM and `Link` header.
 */
export function relMeFindings(links: readonly RelLink[]): Finding[] {
  const me = withRel(links, 'me');
  if (me.length === 0) {
    return [];
  }
  const empty = me.filter((link) => link.href === '');
  if (empty.length > 0) {
    return [
      finding(
        'warning',
        `A 'rel=me' link has no href, so it cannot verify an identity; give every rel=me link a profile URL.`,
      ),
    ];
  }
  return [
    finding(
      'hint',
      `The page advertises ${me.length} rel=me identity link(s) (${me
        .map((link) => link.href)
        .join(
          ', ',
        )}); confirm each profile links back for two-way verification.`,
    ),
  ];
}
