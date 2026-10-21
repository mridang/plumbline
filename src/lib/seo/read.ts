/**
 * Readers that pull SEO relevant facts out of a parsed HTML document. They
 * only need the tiny slice of the DOM described below, so they can be unit
 * tested without running a scan.
 */

import type { HttpHeaders } from '@hint/utils-types';
import { headerValue } from '../../core/http.js';

/** The part of a DOM element these readers use. */
interface ElementLike {
  textContent: string;
  getAttribute(name: string): string | null;
}

/** The part of a DOM document these readers use. */
export interface DocumentLike {
  querySelector(selector: string): ElementLike | null;
  querySelectorAll(selector: string): ElementLike[];
}

/** Returns the trimmed, whitespace collapsed text of the `<title>`, or null when there is none. */
export function getTitle(doc: DocumentLike): string | null {
  const element = doc.querySelector('title:not(svg title)');
  if (!element) {
    return null;
  }
  return element.textContent.replace(/\s+/g, ' ').trim();
}

/** Returns the trimmed content of `<meta name="description">`, or null when the tag is absent. */
export function getMetaDescription(doc: DocumentLike): string | null {
  const element = doc.querySelector('meta[name="description" i]');
  if (!element) {
    return null;
  }
  return (element.getAttribute('content') ?? '').replace(/\s+/g, ' ').trim();
}

/** Counts the `<h1>` elements of the page. */
export function countH1(doc: DocumentLike): number {
  return doc.querySelectorAll('h1').length;
}

/** Returns the trimmed `lang` of `<html>`, or null when absent or blank. */
export function getHtmlLang(doc: DocumentLike): string | null {
  const element = doc.querySelector('html');
  const lang = element?.getAttribute('lang')?.trim() ?? '';
  return lang === '' ? null : lang;
}

/** Expands `none` (shorthand for noindex plus nofollow) and drops blanks. */
function normalizeDirectives(directives: string[]): string[] {
  return directives
    .map((directive) => directive.trim().toLowerCase())
    .filter((directive) => directive !== '')
    .flatMap((directive) =>
      directive === 'none' ? ['none', 'noindex', 'nofollow'] : [directive],
    );
}

/**
 * Returns the lower-cased directives of every `<meta name="robots">`,
 * `googlebot` and `bingbot` tag, for example `['noindex', 'nofollow']`.
 */
export function getRobotsDirectives(doc: DocumentLike): string[] {
  return normalizeDirectives(
    doc
      .querySelectorAll(
        'meta[name="robots" i], meta[name="googlebot" i], meta[name="bingbot" i]',
      )
      .flatMap((element) => (element.getAttribute('content') ?? '').split(',')),
  );
}

/**
 * Returns the lower-cased directives of the `X-Robots-Tag` response header.
 * A leading user agent prefix (`googlebot: noindex`) is dropped.
 */
export function getRobotsHeaderDirectives(
  headers: HttpHeaders | undefined,
): string[] {
  const value = headerValue(headers, 'x-robots-tag');
  if (value === null) {
    return [];
  }
  return normalizeDirectives(
    value
      .split(',')
      .map((part) =>
        part.replace(
          /^\s*(?:googlebot|bingbot|[a-z0-9_-]+)\s*:\s*(?=noindex|nofollow|none)/i,
          '',
        ),
      ),
  );
}

/** Returns the `href` of `<link rel="canonical">`, or null when absent. */
export function getCanonical(doc: DocumentLike): string | null {
  const element = doc.querySelector('link[rel~="canonical" i]');
  if (!element) {
    return null;
  }
  // An empty href declares nothing, so it counts as no canonical at all.
  const href = (element.getAttribute('href') ?? '').trim();
  return href === '' ? null : href;
}

/** True when the page carries a JSON-LD block that parses to a non-empty object or array (a `@graph` is an object). */
export function hasJsonLd(doc: DocumentLike): boolean {
  return doc
    .querySelectorAll('script[type="application/ld+json" i]')
    .some((element) => {
      try {
        const data: unknown = JSON.parse(element.textContent.trim());
        return (
          typeof data === 'object' &&
          data !== null &&
          Object.keys(data).length > 0
        );
      } catch {
        // Unparsable JSON-LD is ignored by search engines.
        return false;
      }
    });
}

/**
 * Compares a canonical URL with the page URL. The canonical is resolved
 * against the page (so relative values work) and fragments are ignored.
 */
export function sameUrl(canonical: string, pageUrl: string): boolean {
  try {
    const a = new URL(canonical, pageUrl);
    const b = new URL(pageUrl);
    a.hash = '';
    b.hash = '';
    return a.href === b.href;
  } catch {
    return false;
  }
}
