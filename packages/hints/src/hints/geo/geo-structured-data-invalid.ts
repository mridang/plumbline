import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { readJsonLd } from '../../lib/geo/json-ld.js';
import { structuredDataInvalidFindings, REF } from '../../lib/geo/checks.js';

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
      const blocks = readJsonLd(page.document);
      for (const { message, severity } of structuredDataInvalidFindings(
        blocks,
      )) {
        page.report(message, {
          severity: severity === 'error' ? Severity.error : Severity.warning,
          // The first block that does not parse.
          element: page.document.querySelectorAll(
            'script[type="application/ld+json" i]',
          )[blocks.invalidAt[0]],
        });
      }
    });
  },
});
