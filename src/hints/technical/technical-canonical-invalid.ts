import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { canonicalHref } from '../../lib/technical/read.js';
import { canonicalInvalidFindings } from '../../lib/technical/checks.js';

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
      for (const { message, severity } of canonicalInvalidFindings(
        href,
        page.url,
      )) {
        page.report(message, {
          severity: severity === 'error' ? Severity.error : Severity.warning,
          element: page.document.querySelector('link[rel~="canonical" i]'),
        });
      }
    });
  },
});
