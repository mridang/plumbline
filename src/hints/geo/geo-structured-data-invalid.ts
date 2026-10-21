import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { readJsonLd } from '../../lib/geo/json-ld.js';

const REF = 'https://github.com/RudrenduPaul/LLMScout';

/**
 * Reports pages with JSON-LD blocks that do not parse as JSON, counting an
 * empty block as invalid. Pages with no JSON-LD at all are left to
 * `seo-structured-data-missing`. Source: LLMScout `structured-data` (fail).
 */
export default defineHint({
  id: 'geo-structured-data-invalid',
  name: 'JSON-LD blocks are valid JSON',
  description: 'Reports JSON-LD blocks that are not valid JSON.',
  category: Category.development,
  groups: ['llmscout', 'agent', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const { total, invalid, invalidAt } = readJsonLd(page.document);
      if (invalid > 0) {
        page.report(
          `${invalid} of ${total} JSON-LD block(s) contain invalid JSON. Fix the malformed JSON-LD block(s) so they parse as valid JSON. Read more: ${REF}`,
          {
            severity: Severity.error,
            // The first block that does not parse.
            element: page.document.querySelectorAll(
              'script[type="application/ld+json" i]',
            )[invalidAt[0]],
          },
        );
      }
    });
  },
});
