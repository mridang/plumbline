import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  titleTooShort,
  SEO_TITLE_TOO_SHORT_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_TITLE_TOO_SHORT_REF;

/**
 * Reports a <title> shorter than 10 characters.
 *
 * Titles under 10 characters miss the chance to hold keywords. Source: opengraph.to "HTML Title Too Short" (info). An empty or missing title is left to seo-title-missing.
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint only points the finding at the `<title>` element.
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
      const [found] = titleTooShort(page.document);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.querySelector('title:not(svg title)'),
        });
      }
    });
  },
});
