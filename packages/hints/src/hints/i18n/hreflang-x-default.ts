import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  hreflangXDefault,
  GOOGLE_LOCALIZED_REF,
} from '../../lib/i18n/checks.js';
import { toSeverity } from './to-severity.js';

const REF = GOOGLE_LOCALIZED_REF;

/**
 * Reports an hreflang set that has no x-default entry.
 *
 * Google recommends an `x-default` alternate naming the page shown when a
 * user's language matches no listed version. Source: Google Search Central
 * "Localized versions" (informational). The predicate, message and severity
 * live in `src/lib/i18n/checks.ts`; this hint only points the finding at the
 * document head.
 */

export default defineHint({
  id: 'hreflang-x-default',
  name: 'hreflang set includes x-default',
  description: 'Reports an hreflang set that has no x-default entry.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const [found] = hreflangXDefault(page.document);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.querySelector('head'),
          codeSnippet:
            '<link rel="alternate" hreflang="x-default" href="https://example.com/">',
          codeLanguage: 'html',
        });
      }
    });
  },
});
