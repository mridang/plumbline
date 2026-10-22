import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { titleMissing, SEO_TITLE_MISSING_REF } from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_TITLE_MISSING_REF;

/**
 * Requires a non-empty <title> element in the head.
 *
 * A page must include a <title>; a missing or empty title fails. Source: opengraph.to "Missing <title> Tag" (error).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts` so the
 * Lighthouse check shares them verbatim; this hint only adds the DOM detail
 * (the offending element, or a suggested snippet when there is none).
 */

export default defineHint({
  id: 'seo-title-missing',
  name: 'Page has a title',
  description: 'Requires a non-empty <title> element in the head.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const [found] = titleMissing(page.document);
      if (found) {
        const existing = page.document.querySelector('title:not(svg title)');
        page.report(
          found.message,
          existing
            ? { severity: toSeverity(found.severity), element: existing }
            : {
                severity: toSeverity(found.severity),
                element: page.document.querySelector('head'),
                codeSnippet: '<title>Descriptive page title</title>',
                codeLanguage: 'html',
              },
        );
      }
    });
  },
});
