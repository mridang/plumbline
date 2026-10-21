import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getTitle } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/html-title-too-long';
const MAX = 70;

/**
 * Warns when the <title> is longer than 70 characters.
 *
 * Titles over 70 characters are truncated in search results. Source: opengraph.to "HTML Title Too Long" (warning).
 */

export default defineHint({
  id: 'seo-title-too-long',
  name: 'Title is not too long',
  description: 'Warns when the <title> is longer than 70 characters.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const title = getTitle(page.document);
      if (title !== null && title.length > MAX) {
        page.report(
          `The <title> is ${title.length} characters long; keep it to ${MAX} or fewer (50-60 is ideal) so it is not truncated in search results. Read more: ${REF}`,
          { severity: Severity.warning },
        );
      }
    });
  },
});
