import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { titleTooLong, SEO_TITLE_TOO_LONG_REF } from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_TITLE_TOO_LONG_REF;

/**
 * Warns when the <title> is longer than 70 characters.
 *
 * Titles over 70 characters are truncated in search results. Source: opengraph.to "HTML Title Too Long" (warning).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint only points the finding at the `<title>` element.
 */

export default defineHint({
  id: 'seo-title-too-long',
  name: 'Title is not too long',
  description: 'Warns when the <title> is longer than 70 characters.',
  category: Category.development,
  groups: ['opengraph', 'seo', 'roctify'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const [found] = titleTooLong(page.document);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.querySelector('title:not(svg title)'),
        });
      }
    });
  },
});
