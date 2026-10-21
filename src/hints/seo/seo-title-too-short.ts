import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getTitle } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/html-title-too-short';
const MIN = 10;

/**
 * Reports a <title> shorter than 10 characters.
 *
 * Titles under 10 characters miss the chance to hold keywords. Source: opengraph.to "HTML Title Too Short" (info). An empty or missing title is left to seo-title-missing.
 */

export default defineHint({
  id: 'seo-title-too-short',
  name: 'Title is not too short',
  description: 'Reports a <title> shorter than 10 characters.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const title = getTitle(page.document);
      // An absent or empty title is a different (error level) problem.
      if (title !== null && title !== '' && title.length < MIN) {
        page.report(
          `The <title> is only ${title.length} characters long; use a more descriptive title of about 50-60 characters. Read more: ${REF}`,
          {
            severity: Severity.hint,
            element: page.document.querySelector('title:not(svg title)'),
          },
        );
      }
    });
  },
});
