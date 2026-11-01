import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { firstSkippedLevel, headingLevels } from '../../lib/technical/read.js';
import { headingHierarchyFindings } from '../../lib/technical/checks.js';

/**
 * Warns when a heading level is skipped (h2 directly followed by h4). Source: LLMScout "heading-structure" (warn). The h1 count is covered by seo-h1-missing and seo-h1-multiple.
 */
export default defineHint({
  id: 'technical-heading-hierarchy',
  name: 'Heading levels are not skipped',
  description:
    'Warns when a heading jumps down more than one level, such as an h2 followed by an h4.',
  category: Category.development,
  groups: ['llmscout', 'seo', 'roctify'],
  reference: 'https://github.com/RudrenduPaul/LLMScout',
  setup(context) {
    onPage(context, (page) => {
      // `firstSkippedLevel` is computed once: the shared check turns it into
      // the finding (message and severity), and its `index` locates the
      // offending heading element for the report.
      const skipped = firstSkippedLevel(headingLevels(page.document));
      for (const { message, severity } of headingHierarchyFindings(skipped)) {
        page.report(message, {
          severity: severity === 'error' ? Severity.error : Severity.warning,
          element: page.document.querySelectorAll('h1, h2, h3, h4, h5, h6')[
            skipped?.index ?? 0
          ],
        });
      }
    });
  },
});
