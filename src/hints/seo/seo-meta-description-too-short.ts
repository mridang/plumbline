import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  metaDescriptionTooShort,
  SEO_META_DESCRIPTION_TOO_SHORT_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_META_DESCRIPTION_TOO_SHORT_REF;

/**
 * Reports a meta description shorter than 50 characters.
 *
 * Short descriptions waste snippet space. Source: opengraph.to "Meta Description Too Short" (info). A missing tag is left to seo-meta-description-missing; an empty one counts as too short.
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint only points the finding at the description tag.
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
      const [found] = metaDescriptionTooShort(page.document);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.querySelector('meta[name="description" i]'),
        });
      }
    });
  },
});
