import type { HintDefinition } from '../../core/define-hint.js';
import seoTitleMissing from './seo-title-missing.js';
import seoTitleTooLong from './seo-title-too-long.js';
import seoTitleTooShort from './seo-title-too-short.js';
import seoMetaDescriptionMissing from './seo-meta-description-missing.js';
import seoMetaDescriptionTooLong from './seo-meta-description-too-long.js';
import seoMetaDescriptionTooShort from './seo-meta-description-too-short.js';
import seoH1Missing from './seo-h1-missing.js';
import seoH1Multiple from './seo-h1-multiple.js';
import seoHtmlLangMissing from './seo-html-lang-missing.js';
import seoRobotsNoindex from './seo-robots-noindex.js';
import seoRobotsNofollow from './seo-robots-nofollow.js';
import seoCanonicalMissing from './seo-canonical-missing.js';
import seoCanonicalMismatch from './seo-canonical-mismatch.js';
import seoStructuredDataMissing from './seo-structured-data-missing.js';
import iconsFaviconMissing from './icons-favicon-missing.js';
import iconsFaviconIcoOrPngMissing from './icons-favicon-ico-or-png-missing.js';
import iconsFavicon32Missing from './icons-favicon-32-missing.js';
import iconsFaviconSvgMissing from './icons-favicon-svg-missing.js';
import seoContentLength from './seo-content-length.js';
import seoKeywordsFrequent from './seo-keywords-frequent.js';
import seoKeywordsInTitle from './seo-keywords-in-title.js';
import seoUrlFriendly from './seo-url-friendly.js';
import seoLinks from './seo-links.js';
import seoLinkAnchorText from './seo-link-anchor-text.js';
import seoDeprecatedHtml from './seo-deprecated-html.js';
import seoHttpStatus from './seo-http-status.js';
import seoViewport from './seo-viewport.js';
import seoResponsiveImages from './seo-responsive-images.js';
import iconsAppleTouchIconMissing from './icons-apple-touch-icon-missing.js';

/** Hints of the `seo` set. */
export const seoHints: readonly HintDefinition[] = [
  seoTitleMissing,
  seoTitleTooLong,
  seoTitleTooShort,
  seoMetaDescriptionMissing,
  seoMetaDescriptionTooLong,
  seoMetaDescriptionTooShort,
  seoH1Missing,
  seoH1Multiple,
  seoHtmlLangMissing,
  seoRobotsNoindex,
  seoRobotsNofollow,
  seoCanonicalMissing,
  seoCanonicalMismatch,
  seoStructuredDataMissing,
  iconsFaviconMissing,
  iconsFaviconIcoOrPngMissing,
  iconsFavicon32Missing,
  iconsFaviconSvgMissing,
  seoContentLength,
  seoKeywordsFrequent,
  seoKeywordsInTitle,
  seoUrlFriendly,
  seoLinks,
  seoLinkAnchorText,
  seoDeprecatedHtml,
  seoHttpStatus,
  seoViewport,
  seoResponsiveImages,
  iconsAppleTouchIconMissing,
];
