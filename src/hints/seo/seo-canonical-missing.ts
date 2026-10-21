import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getCanonical } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/missing-canonical-url';

/**
 * Reports pages without <link rel="canonical">.
 *
 * A canonical link tells search engines the preferred URL. Source: opengraph.to "Missing Canonical URL" (info).
 */

export default defineHint({
  id: 'seo-canonical-missing',
  name: 'Page has a canonical URL',
  description: 'Reports pages without <link rel="canonical">.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      if (getCanonical(page.document) === null) {
        page.report(
          `No canonical URL found. Add <link rel="canonical"> to the <head> with the page's preferred absolute URL. Read more: ${REF}`,
          { severity: Severity.hint },
        );
      }
    });
  },
});
