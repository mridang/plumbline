import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  metaDescriptionTooLong,
  SEO_META_DESCRIPTION_TOO_LONG_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_META_DESCRIPTION_TOO_LONG_REF;

/**
 * Reports a meta description longer than 160 characters.
 *
 * Search snippets are cut off at about 160 characters. Source: opengraph.to "Meta Description Too Long" (info).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint only points the finding at the description tag.
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
      const [found] = metaDescriptionTooLong(page.document);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.querySelector('meta[name="description" i]'),
        });
      }
    });
  },
});
