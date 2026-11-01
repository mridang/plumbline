/**
 * @packageDocumentation
 *
 * What the server-side checks need to know about a page, read in one pass with
 * Cloudflare's `HTMLRewriter`. The rewriter is a streaming parser written in
 * Rust, so reading tags and attributes costs the Worker almost no CPU, which
 * the Free plan limits to 10 ms a request. Reading text through its text
 * callbacks is the expensive part (a callback per chunk), so the words and the
 * link texts come from a regular expression over the raw HTML instead, the
 * same way the hints package strips markup (`visibleText`).
 *
 * Nothing here builds a DOM, so the checks that need one (structure, nesting)
 * stay in the visitor's browser.
 */

import { DEPRECATED_TAGS } from '@mridang/webhint-hint-extra/dist/lib/seo/content.js';

/** An image and what the image checks ask about it. */
export interface ImageFact {
  src: string;
  srcset: string;
  inPicture: boolean;
  /** True when a `<source>` of the same `<picture>` offers WebP, AVIF or JPEG XL. */
  modernSource: boolean;
  lazy: boolean;
}

/** What is read from the page. */
export interface PageFacts {
  title: string | null;
  /** The `content` of the viewport meta tag, or null. */
  viewport: string | null;
  appleTouchIcons: number;
  hrefs: string[];
  images: ImageFact[];
  /** Iframes, which lazy loading applies to as well. */
  iframes: { lazy: boolean }[];
  scripts: number;
  stylesheets: number;
  /** Scripts in the head with neither async, defer nor type=module. */
  blockingScripts: number;
  /** Obsolete elements and how many of each the page uses. */
  deprecated: Record<string, number>;
}

/** The part of the `HTMLRewriter` constructor this module uses. */
export type RewriterFactory = () => HTMLRewriter;

/** The image URLs a `src` and a `srcset` name. */
export function imageUrls(src: string, srcset: string): string[] {
  const candidates = srcset
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/)[0] ?? '')
    .filter((url) => url !== '');
  return [src, ...candidates].filter((url) => url !== '');
}

const MODERN_SOURCE = /image\/(webp|avif|jxl)/i;

/** Reads the facts from `html` in one streaming pass. */
export async function extractFacts(
  html: string,
  rewriter: RewriterFactory = () => new HTMLRewriter(),
): Promise<PageFacts> {
  const facts: PageFacts = {
    title: null,
    viewport: null,
    appleTouchIcons: 0,
    hrefs: [],
    images: [],
    iframes: [],
    scripts: 0,
    stylesheets: 0,
    blockingScripts: 0,
    deprecated: {},
  };
  let titleText = '';
  let inHead = false;
  let picture: ImageFact[] | null = null;
  let pictureModern = false;

  const pass = rewriter()
    .on('head', {
      element(element) {
        inHead = true;
        element.onEndTag(() => {
          inHead = false;
        });
      },
    })
    .on('title', {
      text(chunk) {
        if (facts.title === null) {
          titleText += chunk.text;
          if (chunk.lastInTextNode) {
            facts.title = titleText.trim();
          }
        }
      },
    })
    .on('meta', {
      element(element) {
        const name = (element.getAttribute('name') ?? '').toLowerCase();
        if (name === 'viewport' && facts.viewport === null) {
          facts.viewport = element.getAttribute('content') ?? '';
        }
      },
    })
    .on('link', {
      element(element) {
        const rel = (element.getAttribute('rel') ?? '').toLowerCase();
        const rels = rel.split(/\s+/);
        if (
          rels.includes('apple-touch-icon') ||
          rels.includes('apple-touch-icon-precomposed')
        ) {
          facts.appleTouchIcons += 1;
        }
        if (rels.includes('stylesheet') && element.hasAttribute('href')) {
          facts.stylesheets += 1;
        }
      },
    })
    .on('a[href]', {
      element(element) {
        facts.hrefs.push(element.getAttribute('href') ?? '');
      },
    })
    .on('picture', {
      element(element) {
        picture = [];
        pictureModern = false;
        element.onEndTag(() => {
          for (const image of picture ?? []) {
            image.modernSource = pictureModern;
          }
          picture = null;
        });
      },
    })
    .on('source', {
      element(element) {
        if (picture && MODERN_SOURCE.test(element.getAttribute('type') ?? '')) {
          pictureModern = true;
        }
      },
    })
    .on('img', {
      element(element) {
        const image: ImageFact = {
          src: element.getAttribute('src') ?? '',
          srcset: element.getAttribute('srcset') ?? '',
          inPicture: picture !== null,
          modernSource: false,
          lazy:
            (element.getAttribute('loading') ?? '').toLowerCase() === 'lazy',
        };
        facts.images.push(image);
        picture?.push(image);
      },
    })
    .on('iframe', {
      element(element) {
        facts.iframes.push({
          lazy:
            (element.getAttribute('loading') ?? '').toLowerCase() === 'lazy',
        });
      },
    })
    .on('script[src]', {
      element(element) {
        facts.scripts += 1;
        const type = (element.getAttribute('type') ?? '').toLowerCase();
        if (
          inHead &&
          !element.hasAttribute('async') &&
          !element.hasAttribute('defer') &&
          type !== 'module'
        ) {
          facts.blockingScripts += 1;
        }
      },
    })
    .on(DEPRECATED_TAGS.join(','), {
      element(element) {
        const tag = element.tagName.toLowerCase();
        facts.deprecated[tag] = (facts.deprecated[tag] ?? 0) + 1;
      },
    });

  await pass
    .transform(new Response(html, { headers: { 'content-type': 'text/html' } }))
    .text();
  return facts;
}

/** The value of attribute `name` in the text of a start tag, or an empty string. */
function attribute(attributes: string, name: string): string {
  const match = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    'i',
  ).exec(attributes);
  return match?.[1] ?? match?.[2] ?? match?.[3] ?? '';
}

/** What the anchor-text check asks about one link. */
export interface AnchorText {
  inner: string;
  label: string;
  imageAlt: string;
  title: string;
}

/**
 * The links of `html` with their inner HTML, `aria-label`, `title` and the
 * `alt` of the first image inside. A regular expression, not the rewriter,
 * because link texts would need a callback per text chunk.
 */
export function anchorTexts(html: string): AnchorText[] {
  const out: AnchorText[] = [];
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    const attributes = match[1] ?? '';
    if (!/(?:^|\s)href\s*=/i.test(attributes)) {
      continue;
    }
    const inner = match[2] ?? '';
    const image = /<img\b([^>]*)>/i.exec(inner);
    out.push({
      inner,
      label: attribute(attributes, 'aria-label'),
      title: attribute(attributes, 'title'),
      imageAlt: image ? attribute(image[1] ?? '', 'alt') : '',
    });
  }
  return out;
}
