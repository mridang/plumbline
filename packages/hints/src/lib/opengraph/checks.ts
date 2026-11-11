/**
 * The single source of truth for every Open Graph and Twitter Card rule from
 * https://www.opengraph.to. Each rule is one exported pure function that takes
 * the minimal structural input it needs (a `meta(key)` reader over the page's
 * `og:*`/`twitter:*` tags, and/or the already-fetched `og:image` file) and
 * returns the library {@link Finding}s it produces — the exact message and the
 * severity, nothing webhint- or Lighthouse-specific.
 *
 * Both callers share these functions so the predicate, the message text and the
 * severity can never drift between them:
 *
 * - the webhint hints in `src/hints/opengraph/<id>.ts` (through
 *   `./define.ts`, which turns a returned finding into a webhint report,
 *   adding the element, code snippet and reference link); and
 * - the Lighthouse plugin checks in `lighthouse/src/checks/opengraph.ts`,
 *   which build the same input from the `MetaElements` artifact and return
 *   these findings directly.
 *
 * The functions stay pure and synchronous: anything that needs the network
 * (fetching the `og:image` bytes) is done by the caller, which passes the
 * result in as {@link OgImage}. That keeps every rule unit-testable without a
 * scan and lets the Lighthouse plugin — which runs after gathering and cannot
 * issue a fetch — reuse the tag-only rules while leaving the image-fetch rules
 * to a gatherer.
 */
import { finding, type Finding } from '../headers/finding.js';
import type { ImageInfo } from './image-size.js';
import {
  charLength,
  hasKeywordStuffing,
  normalizeText,
  startsWithUrl,
} from './text.js';

/** Reads the first non-empty value of an `og:*`/`twitter:*` tag, or null. */
type MetaReader = (key: string) => string | null;

/**
 * The fetched `og:image` file, as the caller resolved it. Mirrors what the
 * webhint hint downloads (see `./define.ts`); the image-fetch rules judge the
 * page from this instead of issuing their own request.
 */
export interface OgImage {
  /** Absolute URL that was fetched. */
  url: string;
  /** HTTP status; 0 when the request itself failed. */
  status: number;
  /** Media type without parameters, lowercased; empty when unknown. */
  contentType: string;
  /** Size of the response body in bytes. */
  size: number;
  /** Format and pixel size, or null when the bytes are not a known image. */
  info: ImageInfo | null;
}

/** The input every rule draws from; a rule reads only the fields it needs. */
export interface OgInput {
  /** First non-empty value of a meta tag, or null when absent. */
  meta: MetaReader;
  /** The fetched `og:image`, or null when the page declares none / no fetch. */
  image: OgImage | null;
}

/** A rule that reads only the page's meta tags. */
type MetaCheck = (input: Pick<OgInput, 'meta'>) => Finding[];
/** A rule that reads only the fetched `og:image` file. */
type ImageCheck = (input: Pick<OgInput, 'image'>) => Finding[];

// --- og:title -------------------------------------------------------------

/**
 * `opengraph-title-missing`: an og:title must be present, otherwise platforms
 * fall back to the page title or URL. Reported as an error.
 */
export const ogTitleMissing: MetaCheck = ({ meta }) =>
  meta('og:title') === null
    ? [
        finding(
          'error',
          'The page has no og:title meta tag so social platforms fall back to the page title or URL; add one of 50 to 60 characters.',
        ),
      ]
    : [];

/**
 * `opengraph-title-too-long`: an og:title longer than 60 characters may be
 * truncated. Reported as a warning.
 */
export const ogTitleTooLong: MetaCheck = ({ meta }) => {
  const title = meta('og:title');
  return title !== null && charLength(title) > 60
    ? [
        finding(
          'warning',
          `The og:title is ${charLength(title)} characters long; titles longer than 60 characters may be truncated on social platforms.`,
        ),
      ]
    : [];
};

/**
 * `opengraph-title-too-short`: an og:title shorter than 15 characters may not
 * be descriptive enough. Surfaced as advice (hint).
 */
export const ogTitleTooShort: MetaCheck = ({ meta }) => {
  const title = meta('og:title');
  return title !== null && charLength(title) < 15
    ? [
        finding(
          'hint',
          `The og:title is only ${charLength(title)} characters long; short titles may not be descriptive enough for social sharing (aim for 50 to 60).`,
        ),
      ]
    : [];
};

// --- og:description -------------------------------------------------------

/**
 * `opengraph-description-missing`: an og:description must be present so
 * platforms can show a summary. Reported as an error.
 */
export const ogDescriptionMissing: MetaCheck = ({ meta }) =>
  meta('og:description') === null
    ? [
        finding(
          'error',
          'The page has no og:description meta tag so platforms show no summary under the shared link; add one of 110 to 160 characters.',
        ),
      ]
    : [];

/**
 * `opengraph-description-too-long`: an og:description over 160 characters may
 * be cut off. Reported as a warning. (The info-level "slightly long" rule
 * overlaps on 161 to 200.).
 */
export const ogDescriptionTooLong: MetaCheck = ({ meta }) => {
  const text = meta('og:description');
  // The article says the description "exceeds 160 characters"; the info-level "slightly long" hint overlaps on 161 to 200.
  return text !== null && charLength(text) > 160
    ? [
        finding(
          'warning',
          `The og:description is ${charLength(text)} characters long; descriptions over 160 characters may be cut off on social platforms.`,
        ),
      ]
    : [];
};

/**
 * `opengraph-description-slightly-long`: an og:description of 161 to 200
 * characters may be truncated on some platforms. Surfaced as advice (hint).
 */
export const ogDescriptionSlightlyLong: MetaCheck = ({ meta }) => {
  const text = meta('og:description');
  const length = text === null ? 0 : charLength(text);
  return length > 160 && length <= 200
    ? [
        finding(
          'hint',
          `The og:description is ${length} characters long; descriptions between 160 and 200 characters may be truncated on some platforms (aim for 110 to 160).`,
        ),
      ]
    : [];
};

/**
 * `opengraph-description-too-short`: an og:description shorter than 50
 * characters wastes the preview space. Surfaced as advice (hint).
 */
export const ogDescriptionTooShort: MetaCheck = ({ meta }) => {
  const text = meta('og:description');
  return text !== null && charLength(text) < 50
    ? [
        finding(
          'hint',
          `The og:description is only ${charLength(text)} characters long; use two or three sentences of 110 to 160 characters to persuade people to click.`,
        ),
      ]
    : [];
};

/**
 * `opengraph-description-could-be-longer`: an og:description of 50 to 70
 * characters leaves room for more detail. Surfaced as advice (hint).
 */
export const ogDescriptionCouldBeLonger: MetaCheck = ({ meta }) => {
  const text = meta('og:description');
  const length = text === null ? 0 : charLength(text);
  return length >= 50 && length <= 70
    ? [
        finding(
          'hint',
          `The og:description is ${length} characters long; there is room for a more detailed description of 110 to 160 characters.`,
        ),
      ]
    : [];
};

/**
 * `opengraph-description-is-url`: an og:description that starts with a URL
 * should be a readable summary instead. Reported as a warning.
 */
export const ogDescriptionIsUrl: MetaCheck = ({ meta }) => {
  const text = meta('og:description');
  return text !== null && startsWithUrl(text)
    ? [
        finding(
          'warning',
          'The og:description starts with a URL; replace it with a readable summary of the page.',
        ),
      ]
    : [];
};

/**
 * `opengraph-description-same-as-title`: an og:description identical to the
 * og:title adds no new information. Reported as a warning.
 */
export const ogDescriptionSameAsTitle: MetaCheck = ({ meta }) => {
  const title = meta('og:title');
  const text = meta('og:description');
  return title !== null &&
    text !== null &&
    normalizeText(title) === normalizeText(text)
    ? [
        finding(
          'warning',
          'The og:description is the same as the og:title; the description should add new information.',
        ),
      ]
    : [];
};

/**
 * `opengraph-description-keyword-stuffing`: an og:description that repeats the
 * same word excessively looks spammy. Reported as a warning.
 */
export const ogDescriptionKeywordStuffing: MetaCheck = ({ meta }) => {
  const text = meta('og:description');
  return text !== null && hasKeywordStuffing(text)
    ? [
        finding(
          'warning',
          'The og:description repeats the same word excessively, which looks spammy; write it naturally.',
        ),
      ]
    : [];
};

// --- og:url / og:type / og:site_name / og:locale -------------------------

/**
 * `opengraph-url-missing`: an og:url should hold the canonical absolute HTTPS
 * URL. Reported as a warning.
 */
export const ogUrlMissing: MetaCheck = ({ meta }) =>
  meta('og:url') === null
    ? [
        finding(
          'warning',
          'The page has no og:url meta tag; it should hold the canonical absolute HTTPS URL of the page, without tracking parameters.',
        ),
      ]
    : [];

/**
 * `opengraph-type-missing`: an og:type declares the content type. Surfaced as
 * advice (hint).
 */
export const ogTypeMissing: MetaCheck = ({ meta }) =>
  meta('og:type') === null
    ? [
        finding(
          'hint',
          'The page has no og:type meta tag; declare the content type, using website by default or article for written content.',
        ),
      ]
    : [];

/**
 * `opengraph-site-name-missing`: an og:site_name names the brand. Surfaced as
 * advice (hint).
 */
export const ogSiteNameMissing: MetaCheck = ({ meta }) =>
  meta('og:site_name') === null
    ? [
        finding(
          'hint',
          'The page has no og:site_name meta tag; add the brand name so platforms can identify your site.',
        ),
      ]
    : [];

/**
 * `opengraph-locale-missing`: an og:locale declares the language and region.
 * Surfaced as advice (hint).
 */
export const ogLocaleMissing: MetaCheck = ({ meta }) =>
  meta('og:locale') === null
    ? [
        finding(
          'hint',
          'The page has no og:locale meta tag; declare the language and region, for example en_US (Facebook assumes en_US).',
        ),
      ]
    : [];

// --- og:image (tag-only rules) -------------------------------------------

/**
 * `opengraph-image-missing`: an og:image must be present; pages without one
 * get far less engagement when shared. Reported as an error.
 */
export const ogImageMissing: MetaCheck = ({ meta }) =>
  meta('og:image') === null
    ? [
        finding(
          'error',
          'The page has no og:image meta tag; pages without an image get significantly less engagement when shared.',
        ),
      ]
    : [];

/**
 * `opengraph-image-not-https`: an og:image URL on http:// may be blocked.
 * Reported as a warning. Reads only the tag, not the fetched file.
 */
export const ogImageNotHttps: MetaCheck = ({ meta }) => {
  const src = meta('og:image');
  return src !== null && /^http:\/\//i.test(src)
    ? [
        finding(
          'warning',
          'The og:image URL uses http://; some platforms block non-HTTPS images, so switch to https://.',
        ),
      ]
    : [];
};

/**
 * `opengraph-image-dimensions-missing`: og:image:width and og:image:height
 * should accompany og:image. Reported as a warning. Only applies when an
 * og:image is declared.
 */
export const ogImageDimensionsMissing: MetaCheck = ({ meta }) => {
  if (meta('og:image') === null) {
    return [];
  }
  const absent = ['og:image:width', 'og:image:height'].filter(
    (key) => meta(key) === null,
  );
  return absent.length > 0
    ? [
        finding(
          'warning',
          `The og:image has no ${absent.join(' or ')}; declaring the size (for example 1200 by 630) avoids layout shifts and poor cropping.`,
        ),
      ]
    : [];
};

/**
 * `opengraph-image-alt-missing`: og:image:alt should accompany og:image for
 * accessibility and SEO. Surfaced as advice (hint). Only applies when an
 * og:image is declared.
 */
export const ogImageAltMissing: MetaCheck = ({ meta }) => {
  if (meta('og:image') === null) {
    return [];
  }
  return meta('og:image:alt') === null
    ? [
        finding(
          'hint',
          'The og:image has no og:image:alt; alt text (about 125 characters or fewer) improves accessibility and SEO.',
        ),
      ]
    : [];
};

// --- og:image (image-fetch rules) ----------------------------------------

/**
 * `opengraph-image-broken`: the og:image URL must return an image. Reported as
 * an error. Judges the fetched file: a failed request, a non-2xx status or a
 * non-image content type each fail. No image on the page means nothing to
 * check.
 */
export const ogImageBroken: ImageCheck = ({ image }) => {
  if (image === null) {
    return [];
  }
  if (image.status === 0) {
    return [
      finding('error', `The og:image ${image.url} could not be fetched.`),
    ];
  }
  if (image.status < 200 || image.status >= 300) {
    return [
      finding(
        'error',
        `The og:image ${image.url} returned HTTP ${image.status}.`,
      ),
    ];
  }
  return image.contentType.startsWith('image/')
    ? []
    : [
        finding(
          'error',
          `The og:image ${image.url} is served as '${image.contentType || 'unknown'}', not an image.`,
        ),
      ];
};

/**
 * `opengraph-image-too-small`: an og:image below the minimum size of social
 * platforms (at least 400x256 covers every platform minimum in the article's
 * table). Reported as an error.
 */
export const ogImageTooSmall: ImageCheck = ({ image }) => {
  const info = image?.info;
  // The article's per-platform minimums: Facebook 200x200, X 300x157, WhatsApp ~300x200, Slack ~400x200, Discord 256x256 (Telegram has none).
  // LinkedIn's listed 1200x628 equals its recommendation, not a hard minimum, so it is left out. Meeting every other minimum means at least 400x256.
  return info && (info.width < 400 || info.height < 256)
    ? [
        finding(
          'error',
          `The og:image is ${info.width}x${info.height} pixels, below the minimum of one or more social platforms (at least 400x256 is needed); use 1200x630.`,
        ),
      ]
    : [];
};

/**
 * `opengraph-image-dimensions-too-large`: an og:image over 4096 pixels on a
 * side may be rejected by platforms. Reported as a warning.
 */
export const ogImageDimensionsTooLarge: ImageCheck = ({ image }) => {
  const info = image?.info;
  return info && (info.width > 4096 || info.height > 4096)
    ? [
        finding(
          'warning',
          `The og:image is ${info.width}x${info.height} pixels; images over 4096 pixels on a side may be rejected by platforms (use 1200x630).`,
        ),
      ]
    : [];
};

/**
 * `opengraph-image-too-large`: an og:image over WhatsApp's 500 KB limit is not
 * previewed there. Reported as a warning. Only a successfully-fetched (2xx)
 * image is weighed.
 */
export const ogImageTooLarge: ImageCheck = ({ image }) =>
  image && image.status >= 200 && image.status < 300 && image.size > 500 * 1024
    ? [
        finding(
          'warning',
          `The og:image is ${Math.round(image.size / 1024)} KB; WhatsApp does not show previews for images over 500 KB (aim for 200 to 400 KB).`,
        ),
      ]
    : [];

/**
 * `opengraph-image-non-optimal-size`: an og:image that is not 1200x630 (1.91:1)
 * may be cropped, scaled or letterboxed. Surfaced as advice (hint). The
 * article's table also accepts 1200x628 (X) and 2400x1260 (high-DPI).
 */
export const ogImageNonOptimalSize: ImageCheck = ({ image }) => {
  const info = image?.info;
  if (!info) {
    return [];
  }
  // The article triggers when the size differs from 1200x630 and gives no tolerance. Its own table also lists 1200x628 (X) and mentions 2400x1260 as a high-DPI option, so those three pass.
  const accepted = [
    [1200, 630],
    [1200, 628],
    [2400, 1260],
  ];
  return accepted.some(([w, h]) => info.width === w && info.height === h)
    ? []
    : [
        finding(
          'hint',
          `The og:image is ${info.width}x${info.height} pixels; use 1200x630 (1.91:1) to avoid cropping, scaling or letterboxing.`,
        ),
      ];
};

// --- twitter:* ------------------------------------------------------------

/**
 * `twitter-card-missing`: a twitter:card controls the preview style on
 * X/Twitter. Reported as a warning.
 */
export const twitterCardMissing: MetaCheck = ({ meta }) =>
  meta('twitter:card') === null
    ? [
        finding(
          'warning',
          'The page has no twitter:card meta tag so X/Twitter shows a basic link preview; use summary_large_image.',
        ),
      ]
    : [];

/**
 * `twitter-card-not-large`: when an image is available, summary_large_image is
 * preferable to summary. Surfaced as advice (hint). With no image at all a
 * summary card is fine.
 */
export const twitterCardNotLarge: MetaCheck = ({ meta }) => {
  // The article only applies when an image is available; with no image a summary card is fine.
  const hasImage = meta('twitter:image') !== null || meta('og:image') !== null;
  return hasImage && meta('twitter:card')?.toLowerCase() === 'summary'
    ? [
        finding(
          'hint',
          'The twitter:card is summary; consider summary_large_image to show a large image above the text.',
        ),
      ]
    : [];
};

/**
 * `twitter-title-missing`: a twitter:title tailors the headline for X. Reported
 * as a warning.
 */
export const twitterTitleMissing: MetaCheck = ({ meta }) =>
  meta('twitter:title') === null
    ? [
        finding(
          'warning',
          'The page has no twitter:title meta tag; X falls back to og:title or the page title, which may not suit social sharing.',
        ),
      ]
    : [];

/**
 * `twitter-description-missing`: a twitter:description tailors the summary for
 * X. Reported as a warning.
 */
export const twitterDescriptionMissing: MetaCheck = ({ meta }) =>
  meta('twitter:description') === null
    ? [
        finding(
          'warning',
          'The page has no twitter:description meta tag; X falls back to og:description or the meta description.',
        ),
      ]
    : [];

/**
 * `twitter-image-missing`: fires only when neither twitter:image nor an
 * og:image fallback exists, so X shows a plain link. Reported as a warning.
 */
export const twitterImageMissing: MetaCheck = ({ meta }) =>
  // The article fires only when neither twitter:image nor the og:image fallback exists.
  meta('twitter:image') === null && meta('og:image') === null
    ? [
        finding(
          'warning',
          'The page has no twitter:image meta tag and no og:image to fall back on, so X shows a plain link with no preview image.',
        ),
      ]
    : [];

/**
 * `twitter-site-missing`: a twitter:site attributes shared content to an X
 * account. Surfaced as advice (hint).
 */
export const twitterSiteMissing: MetaCheck = ({ meta }) =>
  meta('twitter:site') === null
    ? [
        finding(
          'hint',
          'The page has no twitter:site meta tag; add your X/Twitter handle to attribute shared content to your account.',
        ),
      ]
    : [];
