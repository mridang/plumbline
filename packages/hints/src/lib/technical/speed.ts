/**
 * Page speed rules ported from the Roctify SEO checker
 * (https://roctify.com/tools/seo-checker): server response time, HTML size,
 * scripts and stylesheets, image formats and lazy loading. Roctify names the
 * checks but not their thresholds, so the limits are ours and are exported as
 * constants. Pure functions over plain values.
 */
import { finding, type Finding } from '../headers/finding.js';

/** Lighthouse's "reduce initial server response time" limit. */
export const SLOW_RESPONSE_MS = 600;

/** Past this the server is slow enough to hurt crawling. */
export const VERY_SLOW_RESPONSE_MS = 1500;

/** HTML heavier than this slows the first paint. */
export const LARGE_HTML_BYTES = 200 * 1024;

/** Googlebot reads only the first 2 MB of an HTML file. */
export const GOOGLEBOT_HTML_BYTES = 2 * 1024 * 1024;

/** More external scripts than this cost a request each. */
export const MAX_SCRIPTS = 15;

/** More external stylesheets than this cost a request each. */
export const MAX_STYLESHEETS = 10;

/** The images at the top of a page are probably visible; do not lazy load them. */
export const EAGER_IMAGES = 2;

/** Warns when the first response took long. */
export function responseTimeFindings(milliseconds: number): Finding[] {
  const shown = Math.round(milliseconds);
  if (milliseconds > VERY_SLOW_RESPONSE_MS) {
    return [
      finding(
        'error',
        `The server took ${shown} ms to respond; aim for under ${SLOW_RESPONSE_MS} ms.`,
      ),
    ];
  }
  if (milliseconds > SLOW_RESPONSE_MS) {
    return [
      finding(
        'warning',
        `The server took ${shown} ms to respond; aim for under ${SLOW_RESPONSE_MS} ms.`,
      ),
    ];
  }
  return [];
}

/** Warns when the HTML document is large. */
export function htmlSizeFindings(bytes: number): Finding[] {
  const kb = Math.round(bytes / 1024);
  if (bytes > GOOGLEBOT_HTML_BYTES) {
    return [
      finding(
        'error',
        `The HTML is ${kb} KB; Googlebot reads only the first 2 MB.`,
      ),
    ];
  }
  if (bytes > LARGE_HTML_BYTES) {
    return [
      finding(
        'warning',
        `The HTML is ${kb} KB; keep it under ${LARGE_HTML_BYTES / 1024} KB.`,
      ),
    ];
  }
  return [];
}

/** What the asset check counts. */
export interface AssetCounts {
  scripts: number;
  stylesheets: number;
  /** Scripts in the head with neither async, defer nor type=module. */
  blockingScripts: number;
}

/** Warns about many requests and about scripts that block rendering. */
export function assetFindings(counts: AssetCounts): Finding[] {
  const out: Finding[] = [];
  if (counts.scripts > MAX_SCRIPTS) {
    out.push(
      finding(
        'warning',
        `The page loads ${counts.scripts} external scripts; combine or remove some (more than ${MAX_SCRIPTS}).`,
      ),
    );
  }
  if (counts.stylesheets > MAX_STYLESHEETS) {
    out.push(
      finding(
        'warning',
        `The page loads ${counts.stylesheets} external stylesheets; combine some (more than ${MAX_STYLESHEETS}).`,
      ),
    );
  }
  if (counts.blockingScripts > 0) {
    out.push(
      finding(
        'warning',
        `${counts.blockingScripts} scripts in the <head> block rendering; add defer or async.`,
      ),
    );
  }
  return out;
}

/** How efficient an image URL's format is, from its file extension. */
export function imageFormat(url: string): 'modern' | 'legacy' | 'other' {
  const extension = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase();
  if (extension === 'webp' || extension === 'avif' || extension === 'jxl') {
    return 'modern';
  }
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(extension ?? '')) {
    return 'legacy';
  }
  return 'other';
}

/** What the image-format check needs to know about an `<img>`. */
export interface ImageFormatInfo {
  /** Every URL the image can load: `src` and the `srcset` candidates. */
  urls: readonly string[];
  /** True when a `<picture><source>` offers WebP or AVIF. */
  hasModernSource: boolean;
}

/** Warns when images ship only as JPEG, PNG or GIF. */
export function imageFormatFindings(
  images: readonly ImageFormatInfo[],
): Finding[] {
  let legacy = 0;
  let modern = 0;
  for (const image of images) {
    const formats = new Set(image.urls.map(imageFormat));
    if (image.hasModernSource || formats.has('modern')) {
      modern += 1;
    } else if (formats.has('legacy')) {
      legacy += 1;
    }
  }
  if (legacy === 0) {
    return [];
  }
  if (modern === 0) {
    return [
      finding(
        'warning',
        `${legacy} images use JPEG, PNG or GIF and none use WebP or AVIF, which are much smaller.`,
      ),
    ];
  }
  return [
    finding(
      'hint',
      `${legacy} images still use JPEG, PNG or GIF; WebP or AVIF would be smaller.`,
    ),
  ];
}

/** What the lazy-loading check needs to know about an `<img>` or `<iframe>`. */
export interface LazyCandidate {
  lazy: boolean;
}

/** Warns when images after the first few are not lazy loaded. */
export function lazyLoadingFindings(
  images: readonly LazyCandidate[],
): Finding[] {
  const eager = images.slice(EAGER_IMAGES).filter((image) => !image.lazy);
  if (eager.length === 0) {
    return [];
  }
  return [
    finding(
      'warning',
      `${eager.length} images after the first ${EAGER_IMAGES} are not lazy loaded; add loading="lazy".`,
    ),
  ];
}
