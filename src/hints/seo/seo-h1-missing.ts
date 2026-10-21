import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { countH1 } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/missing-h1';

/**
 * Warns when the page has no <h1> heading.
 *
 * Every page should have one <h1> that signals its main topic. Source: opengraph.to "Missing H1 Heading" (warning).
 */

export default defineHint({
  id: 'seo-h1-missing',
  name: 'Page has an h1',
  description: 'Warns when the page has no <h1> heading.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      if (countH1(page.document) === 0) {
        page.report(
          `The page has no <h1> heading. Add one that states the main topic. Read more: ${REF}`,
          { severity: Severity.warning },
        );
      }
    });
  },
});
