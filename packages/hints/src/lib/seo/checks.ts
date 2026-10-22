/**
 * Single-source SEO and favicon rules. Every rule here owns three things that
 * used to be copied between the webhint hint (`src/hints/seo/<id>.ts`) and the
 * Lighthouse check (`lighthouse/src/checks/seo.ts`): the predicate (when the
 * rule fails), the exact message shown to the user (including its `Read more:`
 * link), and the finding severity. Each rule is a pure function that reads the
 * page through the existing `src/lib/seo/**` readers and returns a
 * {@link Finding}[] (empty when the page passes).
 *
 * Both callers import these functions:
 *   - the webhint hint turns the returned finding into a `context.report(...)`,
 *     adding only presentation detail (the DOM `element`, a `codeSnippet`) that
 *     needs the live document; the message and severity come from here.
 *   - the Lighthouse check returns the findings as-is.
 *
 * Because the message text lives in exactly one place, the two can never drift.
 * The reference links double as each hint's `reference` metadata, so they are
 * exported too and imported by the hint rather than restated there.
 *
 * Thresholds and wording are faithful to the opengraph.to source each rule
 * came from; see the matching hint's doc comment for the citation.
 */
import type { HttpHeaders } from '@hint/utils-types';
import { finding, type Finding } from '../headers/finding.js';
import {
  countH1,
  findRobotsSource,
  getCanonical,
  getHtmlLang,
  getMetaDescription,
  getTitle,
  hasJsonLd,
  sameUrl,
  type DocumentLike,
} from './read.js';
import {
  getIconLinks,
  isIcoIcon,
  isPng32Icon,
  isPngIcon,
  isSvgIcon,
} from './icons.js';

// ---- Reference links (shared with each hint's `reference` metadata) --------
export const SEO_TITLE_MISSING_REF =
  'https://www.opengraph.to/articles/missing-html-title';
export const SEO_TITLE_TOO_LONG_REF =
  'https://www.opengraph.to/articles/html-title-too-long';
export const SEO_TITLE_TOO_SHORT_REF =
  'https://www.opengraph.to/articles/html-title-too-short';
export const SEO_META_DESCRIPTION_MISSING_REF =
  'https://www.opengraph.to/articles/missing-meta-description';
export const SEO_META_DESCRIPTION_TOO_LONG_REF =
  'https://www.opengraph.to/articles/meta-description-long';
export const SEO_META_DESCRIPTION_TOO_SHORT_REF =
  'https://www.opengraph.to/articles/meta-description-short';
export const SEO_H1_MISSING_REF =
  'https://www.opengraph.to/articles/missing-h1';
export const SEO_H1_MULTIPLE_REF =
  'https://www.opengraph.to/articles/multiple-h1';
export const SEO_HTML_LANG_MISSING_REF =
  'https://www.opengraph.to/articles/missing-html-lang';
export const SEO_ROBOTS_NOINDEX_REF =
  'https://www.opengraph.to/articles/robots-noindex';
export const SEO_ROBOTS_NOFOLLOW_REF =
  'https://www.opengraph.to/articles/robots-nofollow';
export const SEO_CANONICAL_MISSING_REF =
  'https://www.opengraph.to/articles/missing-canonical-url';
export const SEO_CANONICAL_MISMATCH_REF =
  'https://www.opengraph.to/articles/canonical-url-mismatch';
export const SEO_STRUCTURED_DATA_MISSING_REF =
  'https://www.opengraph.to/articles/missing-structured-data';
export const ICONS_FAVICON_MISSING_REF =
  'https://www.opengraph.to/articles/missing-favicon';
export const ICONS_FAVICON_ICO_OR_PNG_MISSING_REF =
  'https://www.opengraph.to/articles/favicon-icon-missing';
export const ICONS_FAVICON_32_MISSING_REF =
  'https://www.opengraph.to/articles/missing-favicon-32';
export const ICONS_FAVICON_SVG_MISSING_REF =
  'https://www.opengraph.to/articles/missing-svg-favicon';

// ---- Thresholds ------------------------------------------------------------
/** The `<title>` length ceiling, from the too-long rule. */
const TITLE_MAX = 70;
/** The `<title>` length floor, from the too-short rule. */
const TITLE_MIN = 10;
/** The meta-description ceiling, from the too-long rule. */
const DESCRIPTION_MAX = 160;
/** The meta-description floor, from the too-short rule. */
const DESCRIPTION_MIN = 50;

// ---- Title -----------------------------------------------------------------

/** Error when the page has no `<title>` or an empty one. */
export function titleMissing(doc: DocumentLike): Finding[] {
  const title = getTitle(doc);
  if (title === null || title === '') {
    return [
      finding(
        'error',
        `The page has no <title> (or it is empty). Add a descriptive <title> to the <head>. Read more: ${SEO_TITLE_MISSING_REF}`,
      ),
    ];
  }
  return [];
}

/** Warning when the `<title>` is longer than {@link TITLE_MAX}. */
export function titleTooLong(doc: DocumentLike): Finding[] {
  const title = getTitle(doc);
  if (title !== null && title.length > TITLE_MAX) {
    return [
      finding(
        'warning',
        `The <title> is ${title.length} characters long; keep it to ${TITLE_MAX} or fewer (50-60 is ideal) so it is not truncated in search results. Read more: ${SEO_TITLE_TOO_LONG_REF}`,
      ),
    ];
  }
  return [];
}

/**
 * Hint when the `<title>` is shorter than {@link TITLE_MIN}. An absent or empty
 * title is the error-level `seo-title-missing` case, not a too-short finding.
 */
export function titleTooShort(doc: DocumentLike): Finding[] {
  const title = getTitle(doc);
  if (title !== null && title !== '' && title.length < TITLE_MIN) {
    return [
      finding(
        'hint',
        `The <title> is only ${title.length} characters long; use a more descriptive title of about 50-60 characters. Read more: ${SEO_TITLE_TOO_SHORT_REF}`,
      ),
    ];
  }
  return [];
}

// ---- Meta description ------------------------------------------------------

/** Error when the page has no `<meta name="description">`. */
export function metaDescriptionMissing(doc: DocumentLike): Finding[] {
  if (getMetaDescription(doc) === null) {
    return [
      finding(
        'error',
        `The page has no <meta name="description"> tag. Add one of about 120-160 characters. Read more: ${SEO_META_DESCRIPTION_MISSING_REF}`,
      ),
    ];
  }
  return [];
}

/** Hint when the meta description is longer than {@link DESCRIPTION_MAX}. */
export function metaDescriptionTooLong(doc: DocumentLike): Finding[] {
  const description = getMetaDescription(doc);
  if (description !== null && description.length > DESCRIPTION_MAX) {
    return [
      finding(
        'hint',
        `The meta description is ${description.length} characters long; keep it to ${DESCRIPTION_MAX} or fewer (150-160 is ideal) so it is not truncated. Read more: ${SEO_META_DESCRIPTION_TOO_LONG_REF}`,
      ),
    ];
  }
  return [];
}

/**
 * Hint when the meta description is shorter than {@link DESCRIPTION_MIN}. A
 * missing tag is `seo-meta-description-missing`; an empty one counts as short.
 */
export function metaDescriptionTooShort(doc: DocumentLike): Finding[] {
  const description = getMetaDescription(doc);
  if (description !== null && description.length < DESCRIPTION_MIN) {
    return [
      finding(
        'hint',
        `The meta description is only ${description.length} characters long; aim for about 150-160 characters. Read more: ${SEO_META_DESCRIPTION_TOO_SHORT_REF}`,
      ),
    ];
  }
  return [];
}

// ---- Headings --------------------------------------------------------------

/** Warning when the page has no `<h1>`. */
export function h1Missing(doc: DocumentLike): Finding[] {
  if (countH1(doc) === 0) {
    return [
      finding(
        'warning',
        `The page has no <h1> heading. Add one that states the main topic. Read more: ${SEO_H1_MISSING_REF}`,
      ),
    ];
  }
  return [];
}

/** Hint when the page has more than one `<h1>`. */
export function h1Multiple(doc: DocumentLike): Finding[] {
  const count = countH1(doc);
  if (count > 1) {
    return [
      finding(
        'hint',
        `The page has ${count} <h1> headings; use one and make the others <h2> or lower. Read more: ${SEO_H1_MULTIPLE_REF}`,
      ),
    ];
  }
  return [];
}

// ---- Language --------------------------------------------------------------

/** Warning when `<html>` has no `lang` attribute. */
export function htmlLangMissing(doc: DocumentLike): Finding[] {
  if (getHtmlLang(doc) === null) {
    return [
      finding(
        'warning',
        `The <html> element has no lang attribute, for example <html lang="en">. Read more: ${SEO_HTML_LANG_MISSING_REF}`,
      ),
    ];
  }
  return [];
}

// ---- Robots ----------------------------------------------------------------

/**
 * Warning when a robots/googlebot/bingbot meta tag (or the `X-Robots-Tag`
 * header) carries `noindex`. The source itself (meta element or header) is
 * re-derived by the caller for the report's `element`/`codeSnippet`.
 */
export function robotsNoindex(
  doc: DocumentLike,
  headers: HttpHeaders | undefined,
): Finding[] {
  if (findRobotsSource(doc, headers, 'noindex')) {
    return [
      finding(
        'warning',
        `The robots meta tag contains "noindex", so search engines will not index this page. Remove it if that is unintended. Read more: ${SEO_ROBOTS_NOINDEX_REF}`,
      ),
    ];
  }
  return [];
}

/** Hint when a robots tag (or the `X-Robots-Tag` header) carries `nofollow`. */
export function robotsNofollow(
  doc: DocumentLike,
  headers: HttpHeaders | undefined,
): Finding[] {
  if (findRobotsSource(doc, headers, 'nofollow')) {
    return [
      finding(
        'hint',
        `The robots meta tag contains "nofollow", so links on this page will not pass SEO value. Remove it if that is unintended. Read more: ${SEO_ROBOTS_NOFOLLOW_REF}`,
      ),
    ];
  }
  return [];
}

// ---- Canonical -------------------------------------------------------------

/** Hint when the page declares no `<link rel="canonical">`. */
export function canonicalMissing(doc: DocumentLike): Finding[] {
  if (getCanonical(doc) === null) {
    return [
      finding(
        'hint',
        `No canonical URL found. Add <link rel="canonical"> to the <head> with the page's preferred absolute URL. Read more: ${SEO_CANONICAL_MISSING_REF}`,
      ),
    ];
  }
  return [];
}

/**
 * Hint when a present canonical points at a different URL than the page. A
 * missing canonical is `seo-canonical-missing`, so only a declared, mismatched
 * one is flagged here.
 */
export function canonicalMismatch(
  doc: DocumentLike,
  pageUrl: string,
): Finding[] {
  const canonical = getCanonical(doc);
  if (canonical !== null && !sameUrl(canonical, pageUrl)) {
    return [
      finding(
        'hint',
        `The canonical URL "${canonical}" differs from the page URL "${pageUrl}". Make it self-referencing unless this is intended. Read more: ${SEO_CANONICAL_MISMATCH_REF}`,
      ),
    ];
  }
  return [];
}

// ---- Structured data -------------------------------------------------------

/** Hint when the page carries no JSON-LD structured data. */
export function structuredDataMissing(doc: DocumentLike): Finding[] {
  if (!hasJsonLd(doc)) {
    return [
      finding(
        'hint',
        `No JSON-LD structured data found. Add a <script type="application/ld+json"> block, for example WebPage or Article. Read more: ${SEO_STRUCTURED_DATA_MISSING_REF}`,
      ),
    ];
  }
  return [];
}

// ---- Favicons --------------------------------------------------------------
// These inspect only the icons the page *declares*. The webhint hints also fall
// back to fetching `/favicon.ico` for the first two rules; that network check
// stays in the hint, which only reports the finding below when the fetch also
// fails. The Lighthouse plugin cannot make that request, so it uses the DOM
// predicate alone.

/** Hint when the page declares no favicon `<link>` at all. */
export function faviconMissing(doc: DocumentLike): Finding[] {
  if (getIconLinks(doc).length === 0) {
    return [
      finding(
        'hint',
        `No favicon found. Add <link rel="icon" href="/favicon.ico"> to the <head> or serve /favicon.ico. Read more: ${ICONS_FAVICON_MISSING_REF}`,
      ),
    ];
  }
  return [];
}

/** Warning when the page declares no `.ico` or `.png` favicon (SVG does not count). */
export function faviconIcoOrPngMissing(doc: DocumentLike): Finding[] {
  const icons = getIconLinks(doc);
  if (!icons.some((icon) => isIcoIcon(icon) || isPngIcon(icon))) {
    return [
      finding(
        'warning',
        `No .ico or .png favicon found; Google Search does not display SVG favicons. Add <link rel="icon" href="/favicon.ico" sizes="any"> or a PNG icon. Read more: ${ICONS_FAVICON_ICO_OR_PNG_MISSING_REF}`,
      ),
    ];
  }
  return [];
}

/** Hint when the page declares no 32x32 PNG favicon. */
export function favicon32Missing(doc: DocumentLike): Finding[] {
  const icons = getIconLinks(doc);
  if (!icons.some(isPng32Icon)) {
    return [
      finding(
        'hint',
        `No 32x32 PNG favicon found. Add <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">. Read more: ${ICONS_FAVICON_32_MISSING_REF}`,
      ),
    ];
  }
  return [];
}

/** Hint when the page declares no SVG favicon. */
export function faviconSvgMissing(doc: DocumentLike): Finding[] {
  const icons = getIconLinks(doc);
  if (!icons.some(isSvgIcon)) {
    return [
      finding(
        'hint',
        `No SVG favicon found. Add <link rel="icon" type="image/svg+xml" href="/favicon.svg">. Read more: ${ICONS_FAVICON_SVG_MISSING_REF}`,
      ),
    ];
  }
  return [];
}
