import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { canonicalHref, resolvesAsUrl } from '../../lib/technical/read.js';

/**
 * Errors when the canonical href is not a valid URL. A relative href is legal and is resolved against the page URL, as LLMScout does. Missing and mismatching canonicals are covered by seo-canonical-*. Source: LLMScout "canonical" (fail).
 */
export default defineHint({
  id: 'technical-canonical-invalid',
  name: 'Canonical URL is valid',
  description:
    'Requires the canonical link href to be a valid URL, absolute or relative.',
  category: Category.development,
  groups: ['llmscout', 'seo'],
  reference: 'https://github.com/RudrenduPaul/LLMScout',
  setup(context) {
    onPage(context, (page) => {
      const href = canonicalHref(page.document);
      if (href !== null && !resolvesAsUrl(href, page.url)) {
        page.report(`Canonical href "${href}" is not a valid URL.`, {
          severity: Severity.error,
        });
      }
    });
  },
});
