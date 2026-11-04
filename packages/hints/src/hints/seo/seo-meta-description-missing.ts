import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  metaDescriptionMissing,
  SEO_META_DESCRIPTION_MISSING_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_META_DESCRIPTION_MISSING_REF;

/**
 * Requires a <meta name="description"> tag.
 *
 * Without it search engines generate a snippet, often a poor one. Source: opengraph.to "Missing Meta Description" (error).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint only adds the `<head>` element and the snippet to add.
 */

export default defineHint({
  id: 'seo-meta-description-missing',
  name: 'Page has a meta description',
  description: 'Requires a <meta name="description"> tag.',
  category: Category.development,
  groups: ['opengraph', 'seo', 'roctify'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const [found] = metaDescriptionMissing(page.document);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.querySelector('head'),
          codeSnippet:
            '<meta name="description" content="A summary of the page of about 120-160 characters.">',
          codeLanguage: 'html',
        });
      }
    });
  },
});
