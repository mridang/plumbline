import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getHreflangLinks, isAbsoluteHttpUrl } from '../../lib/i18n/read.js';
import { hreflangReturn, GOOGLE_LOCALIZED_REF } from '../../lib/i18n/checks.js';
import { toSeverity } from './to-severity.js';

const REF = GOOGLE_LOCALIZED_REF;

/**
 * Flags hreflang alternates that use a non-absolute URL.
 *
 * Google confirms localized versions through reciprocal "return" links, which
 * only resolve when every alternate names a fully-qualified https:// URL.
 * Source: Google Search Central "Localized versions" (warning). The predicate,
 * message and severity live in `src/lib/i18n/checks.ts` so the Lighthouse check
 * shares them verbatim; this hint re-derives the offending elements, in the
 * same document order the rule emits findings, so each can be pointed at.
 */

export default defineHint({
  id: 'hreflang-return',
  name: 'hreflang alternates use absolute URLs',
  description: 'Flags hreflang alternates that use a non-absolute URL.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const findings = hreflangReturn(page.document);
      // The rule filters the same reader output by the same predicate, so the
      // offending elements line up with the findings by index.
      const elements = getHreflangLinks(page.document)
        .filter((link) => link.href !== '' && !isAbsoluteHttpUrl(link.href))
        .map((link) => link.element);
      findings.forEach((found, index) => {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: elements[index],
        });
      });
    });
  },
});
