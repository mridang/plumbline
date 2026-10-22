import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  canonicalMismatch,
  SEO_CANONICAL_MISMATCH_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_CANONICAL_MISMATCH_REF;

/**
 * Reports a canonical URL that differs from the page URL.
 *
 * A canonical pointing elsewhere is sometimes intended but is often a template error. Source: opengraph.to "Canonical URL Mismatch" (info). A missing canonical is left to seo-canonical-missing.
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint only points the finding at the canonical link.
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
      const [found] = canonicalMismatch(page.document, page.url);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.querySelector('link[rel~="canonical" i]'),
        });
      }
    });
  },
});
