import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { countH1 } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/multiple-h1';

/**
 * Reports pages with more than one <h1>.
 *
 * Best practice is exactly one <h1> per page. Source: opengraph.to "Multiple H1 Tags Found" (info).
 */

export default defineHint({
  id: 'seo-h1-multiple',
  name: 'Page has a single h1',
  description: 'Reports pages with more than one <h1>.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const count = countH1(page.document);
      if (count > 1) {
        page.report(
          `The page has ${count} <h1> headings; use one and make the others <h2> or lower. Read more: ${REF}`,
          {
            severity: Severity.hint,
            // The first extra heading is the one to demote.
            element: page.document.querySelectorAll('h1')[1],
          },
        );
      }
    });
  },
});
