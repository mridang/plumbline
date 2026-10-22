/**
 * Single-source internationalisation rules. Every rule here owns three things
 * so the webhint hint (`src/hints/i18n/<id>.ts`) and the Lighthouse check
 * (`lighthouse/src/checks/i18n.ts`) can never drift: the predicate (when the
 * rule fails), the exact message shown to the user (including its `Read more:`
 * link), and the finding severity. Each rule is a pure function that reads the
 * page through the `src/lib/i18n/read.ts` readers and returns a {@link
 * Finding}[] (empty when the page passes).
 *
 * Both callers import these functions:
 *   - the webhint hint turns each returned finding into a `context.report(...)`,
 *     adding only presentation detail (the DOM `element`) that needs the live
 *     document; the message and severity come from here. Because a rule can
 *     return several findings, the hint re-derives the offending elements in
 *     the same document order and pairs them with the findings by index.
 *   - the Lighthouse check returns the findings as-is.
 *
 * The reference links double as each hint's `reference` metadata, so they are
 * exported too and imported by the hint rather than restated there.
 *
 * Wording and thresholds are faithful to Google's "Localized versions" guidance
 * and MDN's link-relation reference; see each hint's doc comment for the exact
 * citation.
 */
import { finding, type Finding } from '../headers/finding.js';
import {
  getAlternateMediaLinks,
  getHreflangLinks,
  getPaginationLinks,
  isAbsoluteHttpUrl,
  isValidHreflang,
  sameUrl,
  type DocumentLike,
} from './read.js';

// ---- Reference links (shared with each hint's `reference` metadata) --------
/** Google Search Central: localized versions of a page (`hreflang`). */
export const GOOGLE_LOCALIZED_REF =
  'https://developers.google.com/search/docs/specialty/international/localized-versions';
/** MDN: the `rel` attribute link types (`alternate`, `prev`, `next`). */
export const MDN_LINK_REL_REF =
  'https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel';

// ---- hreflang: return (reciprocity) ----------------------------------------

/**
 * Warning for each `hreflang` alternate whose `href` is not an absolute,
 * fully-qualified `http`/`https` URL. Google verifies language versions by
 * reciprocal "return" links: page A must point to B and B back to A. That
 * verification only works when every alternate uses a fully-qualified URL, so a
 * relative or protocol-relative `href` silently breaks the return relationship.
 * One finding is returned per offending alternate, in document order.
 */
export function hreflangReturn(doc: DocumentLike): Finding[] {
  return getHreflangLinks(doc)
    .filter((link) => link.href !== '' && !isAbsoluteHttpUrl(link.href))
    .map((link) =>
      finding(
        'warning',
        `The hreflang alternate for "${link.hreflang}" uses "${link.href}", which is not an absolute URL. Use a fully-qualified https:// URL so reciprocal return tags can resolve. Read more: ${GOOGLE_LOCALIZED_REF}`,
      ),
    );
}

// ---- hreflang: x-default ---------------------------------------------------

/**
 * Hint when the page declares one or more `hreflang` alternates but none is
 * `x-default`. Google recommends an `x-default` entry naming the page shown to
 * users whose language does not match any listed version. Advisory: a set
 * without it still works, so this is information, not an error.
 */
export function hreflangXDefault(doc: DocumentLike): Finding[] {
  const links = getHreflangLinks(doc);
  if (links.length === 0) {
    return [];
  }
  const hasDefault = links.some(
    (link) => link.hreflang.toLowerCase() === 'x-default',
  );
  if (!hasDefault) {
    return [
      finding(
        'hint',
        `The page declares ${links.length} hreflang alternate(s) but no x-default. Add <link rel="alternate" hreflang="x-default" href="…"> for users whose language matches no listed version. Read more: ${GOOGLE_LOCALIZED_REF}`,
      ),
    ];
  }
  return [];
}

// ---- hreflang: valid codes -------------------------------------------------

/**
 * Warning for each `hreflang` value that is neither `x-default` nor a valid
 * ISO 639-1 language with an optional ISO 3166-1 alpha-2 region. A malformed
 * code (for example `en_US` or `eng`) is ignored by search engines, so the
 * alternate is lost. One finding per offending value, in document order.
 */
export function hreflangValidCodes(doc: DocumentLike): Finding[] {
  return getHreflangLinks(doc)
    .filter((link) => !isValidHreflang(link.hreflang))
    .map((link) =>
      finding(
        'warning',
        `The hreflang value "${link.hreflang}" is not a valid ISO 639-1 language (with an optional ISO 3166-1 region) or "x-default". Use a value such as "en" or "en-US". Read more: ${GOOGLE_LOCALIZED_REF}`,
      ),
    );
}

// ---- hreflang: self-reference ----------------------------------------------

/**
 * Warning when the page declares `hreflang` alternates but none points back at
 * the page's own URL. Google requires every language version, including the
 * current page, to list itself; without the self-referencing entry the set is
 * incomplete and the return tags cannot be confirmed. Alternates whose `href`
 * is empty or unparsable cannot match and are ignored for this comparison.
 */
export function hreflangSelf(doc: DocumentLike, pageUrl: string): Finding[] {
  const links = getHreflangLinks(doc);
  if (links.length === 0) {
    return [];
  }
  const referencesSelf = links.some(
    (link) => link.href !== '' && sameUrl(link.href, pageUrl),
  );
  if (!referencesSelf) {
    return [
      finding(
        'warning',
        `The page declares ${links.length} hreflang alternate(s) but none references the page itself ("${pageUrl}"). Add a self-referencing <link rel="alternate" hreflang="…"> for this page. Read more: ${GOOGLE_LOCALIZED_REF}`,
      ),
    ];
  }
  return [];
}

// ---- hreflang: duplicates --------------------------------------------------

/**
 * Warning for each `hreflang` value that appears on more than one alternate
 * (compared case-insensitively). Two alternates claiming the same language send
 * a conflicting signal, so search engines may ignore the set. A finding is
 * returned for each alternate after the first of a repeated value, in document
 * order, so each duplicate element can be pointed at.
 */
export function hreflangDuplicate(doc: DocumentLike): Finding[] {
  const seen = new Set<string>();
  const findings: Finding[] = [];
  for (const link of getHreflangLinks(doc)) {
    const key = link.hreflang.toLowerCase();
    if (key === '') {
      continue;
    }
    if (seen.has(key)) {
      findings.push(
        finding(
          'warning',
          `The hreflang value "${link.hreflang}" is declared more than once. Each language version must appear exactly once; remove the duplicate. Read more: ${GOOGLE_LOCALIZED_REF}`,
        ),
      );
    } else {
      seen.add(key);
    }
  }
  return findings;
}

// ---- rel=alternate media ---------------------------------------------------

/**
 * Warning for each `<link rel="alternate" media="…">` that is malformed: an
 * empty `media` query, or an `href` that is not an absolute `http`/`https` URL.
 * A media alternate (such as a separate mobile URL) only works when both the
 * media query and a fully-qualified target are present. One finding per
 * offending link, in document order.
 */
export function alternateMedia(doc: DocumentLike): Finding[] {
  return getAlternateMediaLinks(doc)
    .filter((link) => link.media === '' || !isAbsoluteHttpUrl(link.href))
    .map((link) =>
      finding(
        'warning',
        `The <link rel="alternate"> with media="${link.media}" and href="${link.href}" is not valid: it needs a non-empty media query and an absolute https:// href. Read more: ${MDN_LINK_REL_REF}`,
      ),
    );
}

// ---- rel=prev / rel=next pagination ----------------------------------------

/**
 * Warning for each `<link rel="prev">` or `<link rel="next">` whose `href` is
 * missing or not an absolute `http`/`https` URL. When a page declares
 * pagination relations they must resolve to real, fully-qualified pages;
 * a blank or relative value makes the relation useless. One finding per
 * offending link, in document order (all `prev` first, then `next`).
 */
export function paginationRel(doc: DocumentLike): Finding[] {
  return getPaginationLinks(doc)
    .filter((link) => !isAbsoluteHttpUrl(link.href))
    .map((link) =>
      finding(
        'warning',
        `The <link rel="${link.rel}"> href "${link.href}" is not an absolute URL. Give rel="prev"/rel="next" a fully-qualified https:// URL. Read more: ${MDN_LINK_REL_REF}`,
      ),
    );
}
