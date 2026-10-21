import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getCanonical, sameUrl } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/canonical-url-mismatch';

/**
 * Reports a canonical URL that differs from the page URL.
 *
 * A canonical pointing elsewhere is sometimes intended but is often a template error. Source: opengraph.to "Canonical URL Mismatch" (info). A missing canonical is left to seo-canonical-missing.
 */

export default defineHint({
  id: 'seo-canonical-mismatch',
  name: 'Canonical URL matches the page',
  description: 'Reports a canonical URL that differs from the page URL.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const canonical = getCanonical(page.document);
      if (canonical !== null && !sameUrl(canonical, page.url)) {
        page.report(
          `The canonical URL "${canonical}" differs from the page URL "${page.url}". Make it self-referencing unless this is intended. Read more: ${REF}`,
          {
            severity: Severity.hint,
            element: page.document.querySelector('link[rel~="canonical" i]'),
          },
        );
      }
    });
  },
});
