/**
 * Shared scaffolding for the Open Graph hints from https://www.opengraph.to.
 * Every rule there is one small check on the page's meta tags (and, for the
 * image rules, on the `og:image` file itself). The rule's predicate, message
 * and severity live in `./checks.ts` as a pure function returning
 * {@link Finding}s; this module builds that function's input from the scanned
 * webhint page, runs it and turns each finding into a webhint report.
 */
import type { HintContext } from 'hint';
import type { HTMLElement } from '@hint/utils-dom';
import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import type { HintDefinition } from '../../core/define-hint.js';
import type { Group } from '../../core/groups.js';
import { onPage } from '../../core/page.js';
import { metaElement, metaValue, type MetaDocument } from './meta.js';
import { sniffImage } from './image-size.js';
import type { Finding, FindingSeverity } from '../headers/finding.js';
import type { OgImage, OgInput } from './checks.js';

/** Maps a library finding severity onto webhint's `Severity` enum. */
const SEVERITIES: Record<FindingSeverity, Severity> = {
  error: Severity.error,
  warning: Severity.warning,
  hint: Severity.hint,
};

export interface OgRule {
  /** Hint id, for example `opengraph-title-missing`. */
  id: string;
  name: string;
  description: string;
  /** Article slug on opengraph.to. */
  slug: string;
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

  /**
   * The rule reads the fetched `og:image` bytes, so the image must be
   * downloaded before `run` is called. Left out for rules that only read tags
   * (even `image`-reported ones such as `opengraph-image-not-https`), so no
   * network request is made for them — matching the old lazy behaviour.
   */
  fetchImage?: boolean;

  /**
   * The rule itself: the exported pure function from `./checks.ts`. It reads
   * the fields of {@link OgInput} it needs and returns the findings (with their
   * message and severity), which this module reports.
   */
  run(input: OgInput): Finding[];
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

/**
 * Resolves the page's `og:image` to a downloaded {@link OgImage}, or null when
 * the page declares none. On a URL that will not parse it returns a failed
 * image with the raw `src` as the URL, exactly as the old inline resolver did.
 */
async function resolveImage(
  context: HintContext,
  doc: MetaDocument,
  pageUrl: string,
): Promise<OgImage | null> {
  const src = metaValue(doc, 'og:image');
  if (src === null) {
    return null;
  }
  let url: string;
  try {
    url = new URL(src, pageUrl).href;
  } catch {
    return { url: src, status: 0, contentType: '', size: 0, info: null };
  }
  return fetchImage(context, url);
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
        // Only the image-fetch rules need the downloaded file; everything else
        // reads tags only, so no network request is made for them.
        const image = rule.fetchImage
          ? await resolveImage(context, doc, page.url)
          : null;
        const findings = rule.run({
          meta: (key) => metaValue(doc, key),
          image,
        });
        if (findings.length === 0) {
          return;
        }
        // The element, resource and code-snippet a finding carries come from
        // the rule's metadata (not its predicate), so they are the same for
        // every finding this rule can return.
        const tagKey = rule.image ? 'og:image' : rule.at;
        const tag = tagKey ? metaElement(doc, tagKey) : null;
        const head = page.document.querySelector('head');
        const element = (tag ??
          head ??
          page.document.documentElement) as unknown as HTMLElement;
        const src = rule.image ? metaValue(doc, 'og:image') : null;
        const resource = src === null ? page.url : resolveUrl(src, page.url);
        for (const { message, severity } of findings) {
          context.report(resource, `${message} See ${articleUrl(rule.slug)}`, {
            severity: SEVERITIES[severity],
            element,
            ...(tag === null && rule.add
              ? { codeSnippet: rule.add, codeLanguage: 'html' as const }
              : {}),
          });
        }
      });
    },
  });
}
