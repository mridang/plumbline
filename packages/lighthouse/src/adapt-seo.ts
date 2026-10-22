/**
 * Adapters that turn Lighthouse artifacts into the small structural shapes the
 * webhint-hints `src/lib/seo/**` readers expect, so the Lighthouse SEO audits
 * run the exact same functions the webhint hints run and therefore produce the
 * same findings. Nothing here re-implements a check: each adapter only reshapes
 * artifact data into the tiny `DocumentLike` / `HttpHeaders` the readers walk.
 *
 * This is the `seo` set's own adapter (the task forbids touching the shared
 * `adapt.ts`); it is consumed only by `checks/seo.ts`.
 *
 * Where the facts come from, and why:
 *   - `<meta name=…>` (description, robots/googlebot/bingbot): the parsed
 *     `MetaElements` artifact, which exposes `name`/`content` reliably.
 *   - `<link rel="canonical">`: the parsed `LinkElements` artifact, which
 *     exposes `rel` and the resolved `href`.
 *   - `<title>` text, the count of `<h1>`, the `<html lang>` attribute, favicon
 *     `<link>` tags (with their `type`/`sizes`) and `<script
 *     type="application/ld+json">` contents: parsed out of the raw
 *     `MainDocumentContent` HTML. Lighthouse has no Title/H1/lang artifact, and
 *     its `LinkElements` omit the `type`/`sizes` attributes the favicon rules
 *     need, and it exposes no inline-script *contents* artifact — so for these
 *     the main document's HTML is the only source Lighthouse gathers by
 *     default. This is a documented limitation: a `<title>` nested in inline
 *     SVG, or markup assembled by script after load, is not seen here.
 *
 * The HTML is parsed with `@hint/utils-dom`'s `createHTMLDocument` — the same
 * DOM implementation the webhint connector uses to build `page.document`, and
 * the same one the `src/lib/seo/**` unit tests parse fixtures with. Using the
 * real parser (rather than a hand-rolled regex scanner) means a malformed or
 * very large page is handled exactly as webhint handles it: no quadratic
 * backtracking, no mis-parsing of nested or unusual markup, and the readers see
 * precisely the elements a browser would.
 */
import { createRequire } from 'node:module';
import type { HTMLDocument } from '@hint/utils-dom';
// The library's readers consume the compiled JavaScript under `@mridang/webhint-hint-extra/dist/**`
// (the root build runs before this package builds), exactly as `adapt.ts` and
// the header checks do, which keeps this package's `rootDir` at `src`.
import type { DocumentLike } from '@mridang/webhint-hint-extra/dist/lib/seo/read.js';
import type { HeaderBag } from '@mridang/webhint-hint-extra/dist/lib/headers/http-headers.js';
import type { MetaElementArtifact } from './adapt.js';

// `@hint/utils-dom` ships as CommonJS, so it is loaded through `createRequire`
// (the pattern the parent package's tests use) rather than a named ESM import,
// which does not resolve reliably against this CJS module. The signature is
// narrowed to the one function this adapter needs.
const require = createRequire(import.meta.url);
const { createHTMLDocument } = require('@hint/utils-dom') as {
  createHTMLDocument: (html: string, finalHref: string) => HTMLDocument;
};

/** Lighthouse's `LinkElement` artifact entry, narrowed to what we read. */
export interface LinkElementArtifact {
  rel: string;
  href: string | null;
}

/** The minimal DOM element the SEO readers call (`textContent` + `getAttribute`). */
interface ElementLike {
  textContent: string;
  getAttribute(name: string): string | null;
}

/** Builds an {@link ElementLike} from a lower-cased attribute map and its text. */
function makeElement(
  attributes: Readonly<Record<string, string>>,
  textContent = '',
): ElementLike {
  return {
    textContent,
    getAttribute(name: string): string | null {
      return attributes[name.toLowerCase()] ?? null;
    },
  };
}

/** True when a `rel` attribute's space-separated tokens include `token`. */
function relHasToken(rel: string, token: string): boolean {
  return rel.trim().toLowerCase().split(/\s+/).includes(token);
}

/**
 * Parses `html` with webhint's DOM implementation. `finalHref` is only used to
 * resolve relative URLs; the SEO readers read raw attribute values, so any
 * valid absolute URL works, and an empty document URL is replaced with a
 * harmless placeholder so parsing never throws on `new URL('')`.
 */
function parseDocument(html: string, finalHref: string): HTMLDocument {
  return createHTMLDocument(html, finalHref || 'http://localhost/');
}

/**
 * Builds the {@link DocumentLike} the SEO readers query, backed by the
 * Lighthouse artifacts. Two sources feed it:
 *
 *   - `<title>`, `<html>`, `<h1>`, favicon `<link>`s and JSON-LD `<script>`s
 *     are served straight from the parsed `MainDocumentContent` document, so
 *     the readers see exactly what the webhint hints see for those selectors.
 *   - the meta description, the robots metas and the canonical link are served
 *     from Lighthouse's dedicated parsed artifacts (`MetaElements`,
 *     `LinkElements`), which carry those facts reliably (the canonical `href`
 *     already resolved).
 *
 * The readers only ever pass a fixed, known set of CSS selectors, so this
 * dispatches on those selectors; an unrecognised selector yields nothing, which
 * is safe because the readers never emit one.
 */
export function seoDocument(artifacts: {
  MetaElements: readonly MetaElementArtifact[];
  LinkElements: readonly LinkElementArtifact[];
  MainDocumentContent: string;
  url?: string;
}): DocumentLike {
  const html = artifacts.MainDocumentContent ?? '';
  // Parse the raw HTML once; every HTML-backed selector is answered from it.
  const parsed = parseDocument(html, artifacts.url ?? '');

  // `<meta>` elements, from the parsed artifact.
  const metas = artifacts.MetaElements.map((meta) =>
    makeElement({
      name: meta.name ?? '',
      content: meta.content ?? '',
      property: meta.property ?? '',
      'http-equiv': meta.httpEquiv ?? '',
    }),
  );
  const descriptionMetas = artifacts.MetaElements.map((meta, index) => ({
    meta,
    element: metas[index],
  }))
    .filter(
      ({ meta }) => (meta.name ?? '').trim().toLowerCase() === 'description',
    )
    .map(({ element }) => element);
  const robotsMetas = artifacts.MetaElements.map((meta, index) => ({
    meta,
    element: metas[index],
  }))
    .filter(({ meta }) =>
      ['robots', 'googlebot', 'bingbot'].includes(
        (meta.name ?? '').trim().toLowerCase(),
      ),
    )
    .map(({ element }) => element);

  // `<link rel="canonical">`, from the parsed artifact (rel + resolved href).
  const canonicalLinks = artifacts.LinkElements.filter((link) =>
    relHasToken(link.rel, 'canonical'),
  ).map((link) => makeElement({ rel: link.rel, href: link.href ?? '' }));

  return {
    querySelector(selector: string): ElementLike | null {
      // `<title>`: `getTitle` passes `'title:not(svg title)'`.
      if (/^title\b/.test(selector)) {
        return parsed.querySelector(selector);
      }
      // `<html>`: `getHtmlLang` passes `'html'`.
      if (selector === 'html') {
        return parsed.querySelector(selector);
      }
      // `<meta name="description">`: `getMetaDescription`.
      if (selector.includes('description')) {
        return descriptionMetas[0] ?? null;
      }
      // `<link rel="canonical">`: `getCanonical`.
      if (selector.includes('canonical')) {
        return canonicalLinks[0] ?? null;
      }
      return null;
    },
    querySelectorAll(selector: string): ElementLike[] {
      // `<h1>`: `countH1` reads only `.length`.
      if (selector === 'h1') {
        return parsed.querySelectorAll(selector);
      }
      // robots/googlebot/bingbot metas: `getRobotsDirectives`/`findRobotsSource`.
      if (selector.includes('robots')) {
        return robotsMetas;
      }
      // favicon links (`link[rel~="icon" i][href]`): `getIconLinks`.
      if (selector.includes('icon')) {
        return parsed.querySelectorAll(selector);
      }
      // JSON-LD scripts (`script[type="application/ld+json" i]`): `hasJsonLd`.
      if (selector.includes('ld+json')) {
        return parsed.querySelectorAll(selector);
      }
      return [];
    },
  };
}

/**
 * Flattens a {@link HeaderBag} (where a repeated header is an array) into the
 * `HttpHeaders` shape the SEO readers' `findRobotsSource` takes, joining any
 * repeated values with a comma so `X-Robots-Tag` is read exactly as the webhint
 * hint reads it. A repeated header is rare here but kept distinguishable.
 */
export function httpHeadersFromBag(
  bag: HeaderBag | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(bag ?? {})) {
    if (value === undefined) {
      continue;
    }
    headers[name] = Array.isArray(value) ? value.join(', ') : value;
  }
  return headers;
}
