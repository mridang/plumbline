import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getMetaDescription } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/missing-meta-description';

/**
 * Requires a <meta name="description"> tag.
 *
 * Without it search engines generate a snippet, often a poor one. Source: opengraph.to "Missing Meta Description" (error).
 */

export default defineHint({
  id: 'seo-meta-description-missing',
  name: 'Page has a meta description',
  description: 'Requires a <meta name="description"> tag.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      if (getMetaDescription(page.document) === null) {
        page.report(
          `The page has no <meta name="description"> tag. Add one of about 120-160 characters. Read more: ${REF}`,
          {
            severity: Severity.error,
            element: page.document.querySelector('head'),
            codeSnippet:
              '<meta name="description" content="A summary of the page of about 120-160 characters.">',
            codeLanguage: 'html',
          },
        );
      }
    });
  },
});
