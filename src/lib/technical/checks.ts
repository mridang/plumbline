/**
 * Single-source predicates and message text for the `technical` rules. Each
 * function takes the small value one of the `read.ts` logic functions already
 * produced (a heading-level list, an {@link AltCoverage}, a {@link
 * RobotsAdvanced}, and so on) and turns it into the findings a rule reports,
 * message and severity included.
 *
 * Both sides of the project call these: the webhint hint in
 * `src/hints/technical/*` (which additionally picks the DOM element each
 * finding points at) and the Lighthouse check in
 * `lighthouse/src/checks/technical.ts` (which maps the findings onto Lighthouse
 * audit results). Keeping the predicate and its wording here means the two
 * surfaces can never drift: a message is written once and read in both places.
 *
 * The redirect-chain rule already lives in `read.ts` (`redirectVerdict` returns
 * its own message), so it is intentionally absent here; both surfaces call that
 * function directly.
 */
import { finding, type Finding } from '../headers/finding.js';
import {
  type AltCoverage,
  type RobotsAdvanced,
  formatKb,
  imageWeightLevel,
  resolvesAsUrl,
  TWITTER_CARD_TYPES,
} from './read.js';

/** The shape `firstSkippedLevel` returns: a jump of more than one level. */
export interface SkippedLevel {
  from: number;
  to: number;
  index: number;
}

/**
 * Warns when the heading outline skips a level (an h2 directly followed by an
 * h4, say). `skipped` is `firstSkippedLevel(headingLevels(doc))`, or null when
 * the outline never jumps.
 */
export function headingHierarchyFindings(
  skipped: SkippedLevel | null,
): Finding[] {
  if (!skipped) {
    return [];
  }
  return [
    finding(
      'warning',
      `Heading hierarchy skips a level (h${skipped.from} is directly followed by h${skipped.to}). Avoid skipping heading levels.`,
    ),
  ];
}

/**
 * Reports `<img>` elements with no `alt` attribute. `coverage` is
 * `altCoverage(doc)`: null when there is nothing to report, otherwise an error
 * below the warn threshold and advice at or above it.
 */
export function imageAltCoverageFindings(
  coverage: AltCoverage | null,
): Finding[] {
  if (!coverage) {
    return [];
  }
  return [
    finding(
      coverage.failing ? 'error' : 'warning',
      `${coverage.missing} of ${coverage.total} <img> tags are missing an alt attribute (${coverage.percent}% coverage). Add descriptive alt text, or alt="" for purely decorative images.`,
    ),
  ];
}

/**
 * Warns about the robots meta tag's advanced snippet and preview directives.
 * `robots` is `robotsAdvanced(doc)`. A noindex page is skipped (it is excluded
 * from search anyway, so snippet limits are moot), matching the hint.
 */
export function robotsMetaAdvancedFindings(robots: RobotsAdvanced): Finding[] {
  const { content, present, missing } = robots;
  if (content === '') {
    return [
      finding(
        'warning',
        'No meta robots directives found; default Google Search snippet and preview limits will apply. Add <meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1">.',
      ),
    ];
  }
  if (content.split(',').some((token) => token.trim() === 'noindex')) {
    return [];
  }
  if (present.length === 0) {
    return [
      finding(
        'warning',
        `Meta robots tag found ("${content}") but no advanced snippet/preview directives (${missing.join(', ')}).`,
      ),
    ];
  }
  if (missing.length > 0) {
    return [
      finding(
        'warning',
        `Meta robots tag has ${present.join(', ')}, but is missing: ${missing.join(', ')}.`,
      ),
    ];
  }
  return [];
}

/**
 * Errors when the `twitter:card` value is not a recognised card type. `type`
 * is `twitterCardType(doc)`: null when the tag is absent or blank.
 */
export function twitterCardTypeFindings(type: string | null): Finding[] {
  if (
    type !== null &&
    !(TWITTER_CARD_TYPES as readonly string[]).includes(type)
  ) {
    return [
      finding(
        'error',
        `twitter:card value "${type}" is not a recognized card type. Use one of: ${TWITTER_CARD_TYPES.join(', ')}.`,
      ),
    ];
  }
  return [];
}

/**
 * Errors when the canonical href does not resolve to a URL against `base`.
 * `href` is `canonicalHref(doc)`: null when there is no canonical link.
 */
export function canonicalInvalidFindings(
  href: string | null,
  base: string,
): Finding[] {
  if (href !== null && !resolvesAsUrl(href, base)) {
    return [finding('error', `Canonical href "${href}" is not a valid URL.`)];
  }
  return [];
}

/**
 * Judges one image's transfer weight: an error over 500 KB, advice over
 * 200 KB, and null when it is light enough to pass. Both surfaces collect the
 * `(url, bytes)` pairs their own way, then call this for each.
 */
export function imageWeightFinding(url: string, bytes: number): Finding | null {
  const level = imageWeightLevel(bytes);
  if (level === 'ok') {
    return null;
  }
  return finding(
    level === 'fail' ? 'error' : 'warning',
    `The image ${url} weighs ${formatKb(bytes)}; keep images under ${level === 'fail' ? '500' : '200'} KB.`,
  );
}
