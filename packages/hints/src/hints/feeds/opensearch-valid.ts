import { Category, defineHint } from '../../core/define-hint.js';
import { HintScope } from '#hint';
import { getOpenSearchLinks } from '../../lib/feeds/read.js';
import {
  validateOpenSearch,
  OPENSEARCH_VALID_REF,
} from '../../lib/feeds/validate.js';
import { validateLinkedDocuments } from './shared.js';

const REF = OPENSEARCH_VALID_REF;

/**
 * Fetches the discovered OpenSearch description and checks it is well-formed.
 *
 * Discovery only says a description is *declared*; whether the linked document
 * is usable needs a fetch, which a DOM-only plugin cannot do, so this is a
 * webhint-only `onSite` check. The fetched body must be a well-formed
 * `<OpenSearchDescription>` carrying a `<ShortName>` (at most 16 characters)
 * and at least one `<Url>` with a `template` attribute. Source: the OpenSearch
 * 1.1 specification.
 *
 * The parse-and-validate logic is single-sourced in
 * `src/lib/feeds/validate.ts`; this hint only discovers the URL and reports.
 */
export default defineHint({
  id: 'opensearch-valid',
  name: 'Discovered OpenSearch description is valid',
  description:
    'Fetches the discovered OpenSearch description and checks it is well-formed.',
  category: Category.development,
  // Fetching the linked document after the scan is site-scoped work.
  scope: HintScope.site,
  // `original`/`social` are the closest existing groups; the feeds set adds its
  // own source and topic groups through `manifest.ts`, which the lead wires in.
  groups: ['opensearch', 'social'],
  reference: REF,
  setup(context) {
    validateLinkedDocuments(context, {
      label: 'OpenSearch description',
      select: (document, baseUrl) =>
        getOpenSearchLinks(document)
          .map((link) => link.href)
          .filter((href) => href !== '')
          .map((href) => resolve(href, baseUrl)),
      validate: (body) => validateOpenSearch(body),
    });
  },
});

/** Resolves `href` against `baseUrl`, falling back to the raw href. */
function resolve(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}
