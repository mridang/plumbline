import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { h1Multiple, SEO_H1_MULTIPLE_REF } from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_H1_MULTIPLE_REF;

/**
 * Reports pages with more than one <h1>.
 *
 * Best practice is exactly one <h1> per page. Source: opengraph.to "Multiple H1 Tags Found" (info).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint only points the finding at the first extra heading.
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
      const [found] = h1Multiple(page.document);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          // The first extra heading is the one to demote.
          element: page.document.querySelectorAll('h1')[1],
        });
      }
    });
  },
});
