/**
 * Set-specific adapters for the `technical` checks. Like the shared `adapt.ts`,
 * nothing here re-implements a check: each adapter only reshapes a Lighthouse
 * artifact into the tiny structural input one of the reused
 * `src/lib/technical/read.ts` functions already accepts, so those functions run
 * unchanged and yield the same findings their webhint hint would.
 *
 * Two of the technical checks read data Lighthouse does not expose as a parsed
 * artifact: heading order and `<img>` `alt` presence (`ImageElements` carries
 * no `alt`). Both are read from the `MainDocumentContent` artifact — the served
 * HTML — by parsing it with `@hint/utils-dom`'s `createHTMLDocument`, the exact
 * parser webhint itself feeds the hints. That yields a real document the `read`
 * functions query the same way they query `page.document` under the hint, so
 * the two surfaces agree by construction. (This replaces a hand-rolled regex tag
 * reader that could rewind its cursor on a page with several `<script>` tags and
 * loop forever; a real parser removes that whole class of bug.)
 *
 * The rest (`meta[name=robots]`, `meta[name=twitter:card]`, the canonical link,
 * the image sources) come straight from Lighthouse's own parsed `MetaElements`,
 * `LinkElements` and `ImageElements` artifacts, wrapped in the same
 * `TechDocumentLike` shape so the library selectors resolve against them.
 */
import { createHTMLDocument } from '@hint/utils-dom';
import type { Artifacts } from 'lighthouse/types/artifacts.js';
import type { MetaElementArtifact } from './adapt.js';
import type { TechDocumentLike } from '@mridang/webhint-hint-plumbline/dist/lib/technical/read.js';

type NetworkRequest = Artifacts.NetworkRequest;
type LinkElement = Artifacts.LinkElement;
type ImageElement = Artifacts.ImageElement;

/**
 * Parses the served HTML into a real `TechDocumentLike` document with
 * `@hint/utils-dom`. The heading and image-alt checks query it exactly as their
 * webhint hints query `page.document`: `querySelectorAll('h1, …, h6')` for the
 * heading outline and `querySelectorAll('img')` plus `getAttribute('alt')` for
 * alt coverage (an absent attribute reads as null, an empty one as "").
 *
 * `base` is the page URL, so any relative reference the library resolves is
 * resolved against the right origin; it does not affect the heading or alt
 * checks, which read no URLs.
 */
export function htmlDocument(html: string, base: string): TechDocumentLike {
  return createHTMLDocument(html, base) as unknown as TechDocumentLike;
}

/**
 * A `TechDocumentLike` whose `querySelectorAll('img')` yields one element per
 * `ImageElements` entry, each reporting its resolved `src`, for `imageUrls`.
 * Lighthouse already resolved these sources against the document, so the check
 * reads the same set of images the page displayed.
 */
export function imageSourceDocument(
  images: readonly ImageElement[],
): TechDocumentLike {
  const elements = images.map((image) => ({
    nodeName: 'IMG',
    tagName: 'IMG',
    getAttribute(name: string): string | null {
      return name.toLowerCase() === 'src' ? image.src : null;
    },
  }));
  return {
    querySelector: () => null,
    querySelectorAll: (selector: string) =>
      selector.trim().toLowerCase() === 'img' ? elements : [],
  };
}

/**
 * A `TechDocumentLike` backed by the parsed `MetaElements` artifact. Supports
 * the two meta selectors the technical checks use —
 * `meta[name="robots" i]` and `meta[name="twitter:card" i]` — returning the
 * first matching element so `robotsAdvanced`/`twitterCardType` read its
 * `content` attribute exactly as they do against a real DOM.
 */
export function metaDocument(
  metaElements: readonly MetaElementArtifact[],
): TechDocumentLike {
  const byName = (name: string) =>
    metaElements
      .filter((meta) => (meta.name ?? '').trim().toLowerCase() === name)
      .map((meta) => ({
        nodeName: 'META',
        tagName: 'META',
        getAttribute(attribute: string): string | null {
          return attribute.toLowerCase() === 'content'
            ? (meta.content ?? null)
            : null;
        },
      }));
  const match = (selector: string) => {
    const lowered = selector.toLowerCase();
    if (lowered.includes('name="robots"')) {
      return byName('robots');
    }
    if (lowered.includes('name="twitter:card"')) {
      return byName('twitter:card');
    }
    return [];
  };
  return {
    querySelector: (selector: string) => match(selector)[0] ?? null,
    querySelectorAll: (selector: string) => match(selector),
  };
}

/**
 * A `TechDocumentLike` backed by the parsed `LinkElements` artifact. Supports
 * `link[rel~="canonical" i]`, returning the first link whose `rel` token list
 * includes `canonical`; its `href` attribute reports the raw attribute value
 * (`hrefRaw`) so `canonicalHref`/`resolvesAsUrl` judge the author's value, not
 * Lighthouse's already-resolved one.
 */
export function linkDocument(
  linkElements: readonly LinkElement[],
): TechDocumentLike {
  const canonical = linkElements
    .filter((link) =>
      (link.rel ?? '').toLowerCase().split(/\s+/).includes('canonical'),
    )
    .map((link) => ({
      nodeName: 'LINK',
      tagName: 'LINK',
      getAttribute(attribute: string): string | null {
        return attribute.toLowerCase() === 'href'
          ? (link.hrefRaw ?? link.href ?? null)
          : null;
      },
    }));
  const match = (selector: string) =>
    selector.toLowerCase().includes('canonical') ? canonical : [];
  return {
    querySelector: (selector: string) => match(selector)[0] ?? null,
    querySelectorAll: (selector: string) => match(selector),
  };
}

/**
 * The transfer weight, in bytes, of every image request in the run, keyed by
 * URL. The value mirrors what the webhint image-weight hint measures: the
 * `Content-Length` header when the server sent a usable one, otherwise the
 * decoded resource size Lighthouse recorded. Non-image requests are ignored.
 *
 * Source artifact: `NetworkRecords` (from `DevtoolsLog`).
 */
export function imageSizesByUrl(
  records: readonly NetworkRequest[],
): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const record of records) {
    if (record.resourceType !== 'Image') {
      continue;
    }
    const header = (record.responseHeaders ?? []).find(
      (entry) => entry.name.toLowerCase() === 'content-length',
    );
    const declared = header ? Number(header.value) : NaN;
    const bytes =
      Number.isFinite(declared) && declared > 0
        ? declared
        : record.resourceSize;
    if (Number.isFinite(bytes) && bytes > 0) {
      sizes.set(record.url, bytes);
    }
  }
  return sizes;
}

/**
 * The redirect hops that led to the main document, as the webhint
 * redirect-chain hint reports them: the URLs of the requests that redirected
 * before the final one. Empty when the document was reached without a redirect.
 */
export function redirectHops(main: NetworkRequest): string[] {
  return (main.redirects ?? []).map((record) => record.url);
}
