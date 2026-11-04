import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { hreflangSelf, GOOGLE_LOCALIZED_REF } from '../../lib/i18n/checks.js';
import { toSeverity } from './to-severity.js';

const REF = GOOGLE_LOCALIZED_REF;

/**
 * Reports an hreflang set that does not reference the page itself.
 *
 * Google requires every language version, the current page included, to list
 * itself; without the self-referencing alternate the set is incomplete.
 * Source: Google Search Central "Localized versions" (warning). The predicate,
 * message and severity live in `src/lib/i18n/checks.ts`; this hint only points
 * the finding at the document head.
 */

export default defineHint({
  id: 'hreflang-self',
  name: 'hreflang set references the page itself',
  description:
    'Reports an hreflang set that does not reference the page itself.',
  category: Category.development,
  groups: ['google', 'seo', 'roctify'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const [found] = hreflangSelf(page.document, page.url);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.querySelector('head'),
        });
      }
    });
  },
});
