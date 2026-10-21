import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getTitle } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/missing-html-title';

/**
 * Requires a non-empty <title> element in the head.
 *
 * A page must include a <title>; a missing or empty title fails. Source: opengraph.to "Missing <title> Tag" (error).
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
      const title = getTitle(page.document);
      if (title === null || title === '') {
        page.report(
          `The page has no <title> (or it is empty). Add a descriptive <title> to the <head>. Read more: ${REF}`,
          { severity: Severity.error },
        );
      }
    });
  },
});
