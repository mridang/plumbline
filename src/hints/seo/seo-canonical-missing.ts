import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  canonicalMissing,
  SEO_CANONICAL_MISSING_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_CANONICAL_MISSING_REF;

/**
 * Reports pages without <link rel="canonical">.
 *
 * A canonical link tells search engines the preferred URL. Source: opengraph.to "Missing Canonical URL" (info).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint only adds the `<head>` element and a page-specific snippet to add.
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
      const [found] = canonicalMissing(page.document);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.querySelector('head'),
          codeSnippet: `<link rel="canonical" href="${page.url}">`,
          codeLanguage: 'html',
        });
      }
    });
  },
});
