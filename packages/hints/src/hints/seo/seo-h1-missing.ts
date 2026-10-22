import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { h1Missing, SEO_H1_MISSING_REF } from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_H1_MISSING_REF;

/**
 * Warns when the page has no <h1> heading.
 *
 * Every page should have one <h1> that signals its main topic. Source: opengraph.to "Missing H1 Heading" (warning).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint only adds the `<body>` element and the snippet to add.
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
      const [found] = h1Missing(page.document);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.querySelector('body'),
          codeSnippet: '<h1>Main topic of the page</h1>',
          codeLanguage: 'html',
        });
      }
    });
  },
});
