import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getMetaDescription } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/meta-description-short';
const MIN = 50;

/**
 * Reports a meta description shorter than 50 characters.
 *
 * Short descriptions waste snippet space. Source: opengraph.to "Meta Description Too Short" (info). A missing tag is left to seo-meta-description-missing; an empty one counts as too short.
 */

export default defineHint({
  id: 'seo-meta-description-too-short',
  name: 'Meta description is not too short',
  description: 'Reports a meta description shorter than 50 characters.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const description = getMetaDescription(page.document);
      if (description !== null && description.length < MIN) {
        page.report(
          `The meta description is only ${description.length} characters long; aim for about 150-160 characters. Read more: ${REF}`,
          {
            severity: Severity.hint,
            element: page.document.querySelector('meta[name="description" i]'),
          },
        );
      }
    });
  },
});
