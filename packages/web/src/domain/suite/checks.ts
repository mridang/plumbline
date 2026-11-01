/**
 * @packageDocumentation
 *
 * The page checks the server can run on its own: the Roctify content, mobile
 * and speed rules, which only need the facts read from the page (`facts.ts`)
 * and the response. Each runs the same pure function the hint of that id runs
 * in the browser scan (`@mridang/webhint-hint-extra/dist/lib`), so the two
 * agree. Those files import nothing else, which keeps the hints package's own
 * code (far over the Worker's size limit) out of the bundle.
 */

import {
  anchorFindings,
  anchorProblem,
  contentLengthFindings,
  deprecatedTagFindings,
  frequentKeywordsFindings,
  friendlyUrlFindings,
  httpStatusFindings,
  keywordsInTitleFindings,
  linkFindings,
  topKeywords,
  visibleText,
  wordsOf,
} from '@mridang/webhint-hint-extra/dist/lib/seo/content.js';
import {
  appleTouchIconFindings,
  responsiveImageFindings,
  viewportFindings,
} from '@mridang/webhint-hint-extra/dist/lib/seo/mobile.js';
import {
  assetFindings,
  htmlSizeFindings,
  imageFormatFindings,
  lazyLoadingFindings,
  responseTimeFindings,
} from '@mridang/webhint-hint-extra/dist/lib/technical/speed.js';
import type { Finding } from '@mridang/webhint-hint-extra/dist/lib/headers/finding.js';

import { anchorTexts, imageUrls, type PageFacts } from '@/domain/suite/facts';

export type { Finding };

/** The fetched page. */
export interface PageResponse {
  url: string;
  status: number;
  /** Milliseconds from the request to the response headers. */
  responseMs: number;
  html: string;
  bytes: number;
}

/** What one check found. */
export interface CheckResult {
  /** The id of the hint that makes the same check in the browser scan. */
  id: string;
  findings: Finding[];
}

/** Runs every server-side check over a fetched page. */
export function runChecks(page: PageResponse, facts: PageFacts): CheckResult[] {
  const text = visibleText(page.html);
  const keywords = topKeywords(text);
  const anchors = anchorTexts(page.html).map((anchor) =>
    anchorProblem({
      text: visibleText(anchor.inner),
      label: anchor.label,
      imageAlt: anchor.imageAlt,
      title: anchor.title,
    }),
  );
  const result = (id: string, findings: Finding[]): CheckResult => ({
    id,
    findings,
  });
  return [
    result('seo-http-status', httpStatusFindings(page.status)),
    result('seo-content-length', contentLengthFindings(wordsOf(text).length)),
    result('seo-keywords-frequent', frequentKeywordsFindings(keywords)),
    result(
      'seo-keywords-in-title',
      keywordsInTitleFindings(facts.title, keywords),
    ),
    result('seo-url-friendly', friendlyUrlFindings(page.url)),
    result(
      'seo-links',
      linkFindings(
        facts.hrefs.map((href) => ({ href })),
        page.url,
      ),
    ),
    result(
      'seo-link-anchor-text',
      anchorFindings(anchors.filter((problem) => problem !== null)),
    ),
    result('seo-deprecated-html', deprecatedTagFindings(facts.deprecated)),
    result('seo-viewport', viewportFindings(facts.viewport)),
    result('seo-responsive-images', responsiveImageFindings(facts.images)),
    result(
      'icons-apple-touch-icon-missing',
      appleTouchIconFindings(facts.appleTouchIcons),
    ),
    result(
      'technical-asset-count',
      assetFindings({
        scripts: facts.scripts,
        stylesheets: facts.stylesheets,
        blockingScripts: facts.blockingScripts,
      }),
    ),
    result('technical-html-size', htmlSizeFindings(page.bytes)),
    result(
      'technical-image-formats',
      imageFormatFindings(
        facts.images.map((image) => ({
          urls: imageUrls(image.src, image.srcset),
          hasModernSource: image.modernSource,
        })),
      ),
    ),
    result(
      'technical-lazy-loading',
      lazyLoadingFindings([...facts.images, ...facts.iframes]),
    ),
    result('technical-response-time', responseTimeFindings(page.responseMs)),
  ];
}
