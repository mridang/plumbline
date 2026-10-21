import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getMetaDescription } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/meta-description-long';
const MAX = 160;

/**
 * Reports a meta description longer than 160 characters.
 *
 * Search snippets are cut off at about 160 characters. Source: opengraph.to "Meta Description Too Long" (info).
 */

export default defineHint({
  id: 'seo-meta-description-too-long',
  name: 'Meta description is not too long',
  description: 'Reports a meta description longer than 160 characters.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const description = getMetaDescription(page.document);
      if (description !== null && description.length > MAX) {
        page.report(
          `The meta description is ${description.length} characters long; keep it to ${MAX} or fewer (150-160 is ideal) so it is not truncated. Read more: ${REF}`,
          { severity: Severity.hint },
        );
      }
    });
  },
});
