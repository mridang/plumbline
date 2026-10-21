/**
 * Shared scaffolding for the Open Graph hints from https://www.opengraph.to.
 * Every rule there is one small check on the page's meta tags (and, for the
 * image rules, on the `og:image` file itself), so a rule is declared as data
 * plus one `check` function and this module turns it into a webhint hint.
 */
import type { HintContext } from 'hint';
import type { HTMLElement } from '@hint/utils-dom';
import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import type { HintDefinition } from '../../core/define-hint.js';
import type { Group } from '../../core/groups.js';
import { onPage } from '../../core/page.js';
import { metaElement, metaValue, type MetaDocument } from './meta.js';
import { sniffImage, type ImageInfo } from './image-size.js';

/** The downloaded `og:image` file. */
interface OgImage {
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

/** What a rule's `check` can look at. */
interface OgContext {
  /** First non-empty value of a meta tag, or null. */
  meta(key: string): string | null;
  /** URL of the scanned page. */
  pageUrl: string;
  /** Fetches `og:image` once; null when the page declares none. */
  image(): Promise<OgImage | null>;
}

export interface OgRule {
  /** Hint id, for example `opengraph-title-missing`. */
  id: string;
  name: string;
  description: string;
  /** Article slug on opengraph.to. */
  slug: string;
  /** Severity the site gives the rule. */
  severity: Severity;
  /** Extra topic groups; `opengraph` and `social` are always added. */
  extraGroups?: readonly Group[];
  category?: Category;
  /**
   * Meta tag that is wrong when it is present; the finding then carries that
   * tag. When the tag is absent the finding carries `<head>` and `add`.
   */
  at?: string;
  /** Tag(s) to suggest when the finding is about something missing. */
  add?: string;
  /**
   * Reports against the resolved `og:image` URL instead of the page, keeping
   * the `og:image` tag as the element.
   */
  image?: boolean;
  /** Returns the problem message (without the link), or null when fine. */
  check(ctx: OgContext): string | null | Promise<string | null>;
}

/** Article URL for a slug. */
const articleUrl = (slug: string): string =>
  `https://www.opengraph.to/articles/${slug}`;

/** Resolves a possibly relative URL, or returns it unchanged when invalid. */
function resolveUrl(src: string, base: string): string {
  try {
    return new URL(src, base).href;
  } catch {
    return src;
  }
}

/** Downloads the image and sniffs its header; never throws. */
async function fetchImage(context: HintContext, url: string): Promise<OgImage> {
  try {
    const data = await context.fetchContent(url);
    const raw = data.response.body.rawContent;
    return {
      url,
      status: data.response.statusCode,
      contentType: (data.response.mediaType ?? '').toLowerCase(),
      size: raw.length,
      info: sniffImage(raw),
    };
  } catch {
    return { url, status: 0, contentType: '', size: 0, info: null };
  }
}

/** Builds a hint from a rule. */
export function defineOgHint(rule: OgRule): HintDefinition {
  return defineHint({
    id: rule.id,
    name: rule.name,
    description: rule.description,
    category: rule.category ?? Category.development,
    groups: ['opengraph', 'social', ...(rule.extraGroups ?? [])],
    reference: articleUrl(rule.slug),
    setup(context) {
      onPage(context, async (page) => {
        const doc = page.document as unknown as MetaDocument;
        let cached: Promise<OgImage | null> | undefined;
        const message = await rule.check({
          meta: (key) => metaValue(doc, key),
          pageUrl: page.url,
          image: () => {
            cached ??= (async () => {
              const src = metaValue(doc, 'og:image');
              if (src === null) {
                return null;
              }
              let url: string;
              try {
                url = new URL(src, page.url).href;
              } catch {
                return {
                  url: src,
                  status: 0,
                  contentType: '',
                  size: 0,
                  info: null,
                };
              }
              return fetchImage(context, url);
            })();
            return cached;
          },
        });
        if (message !== null) {
          const tagKey = rule.image ? 'og:image' : rule.at;
          const tag = tagKey ? metaElement(doc, tagKey) : null;
          const head = page.document.querySelector('head');
          const element = (tag ??
            head ??
            page.document.documentElement) as unknown as HTMLElement;
          const src = rule.image ? metaValue(doc, 'og:image') : null;
          context.report(
            src === null ? page.url : resolveUrl(src, page.url),
            `${message} See ${articleUrl(rule.slug)}`,
            {
              severity: rule.severity,
              element,
              ...(tag === null && rule.add
                ? { codeSnippet: rule.add, codeLanguage: 'html' as const }
                : {}),
            },
          );
        }
      });
    },
  });
}
