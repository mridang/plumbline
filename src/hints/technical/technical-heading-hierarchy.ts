import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { firstSkippedLevel, headingLevels } from '../../lib/technical/read.js';

/**
 * Warns when a heading level is skipped (h2 directly followed by h4). Source: LLMScout "heading-structure" (warn). The h1 count is covered by seo-h1-missing and seo-h1-multiple.
 */
export default defineHint({
  id: 'technical-heading-hierarchy',
  name: 'Heading levels are not skipped',
  description:
    'Warns when a heading jumps down more than one level, such as an h2 followed by an h4.',
  category: Category.development,
  groups: ['llmscout', 'seo'],
  reference: 'https://github.com/RudrenduPaul/LLMScout',
  setup(context) {
    onPage(context, (page) => {
      const skipped = firstSkippedLevel(headingLevels(page.document));
      if (skipped) {
        page.report(
          `Heading hierarchy skips a level (h${skipped.from} is directly followed by h${skipped.to}). Avoid skipping heading levels.`,
          { severity: Severity.warning },
        );
      }
    });
  },
});
