import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getHreflangLinks, isValidHreflang } from '../../lib/i18n/read.js';
import {
  hreflangValidCodes,
  GOOGLE_LOCALIZED_REF,
} from '../../lib/i18n/checks.js';
import { toSeverity } from './to-severity.js';

const REF = GOOGLE_LOCALIZED_REF;

/**
 * Reports hreflang values that are not valid language/region codes.
 *
 * An hreflang value must be `x-default` or an ISO 639-1 language with an
 * optional ISO 3166-1 region; a malformed code is ignored by search engines.
 * Source: Google Search Central "Localized versions" (warning). The predicate,
 * message and severity live in `src/lib/i18n/checks.ts`; this hint re-derives
 * the offending elements in the same order the rule emits findings.
 */

export default defineHint({
  id: 'hreflang-valid-codes',
  name: 'hreflang values are valid codes',
  description:
    'Reports hreflang values that are not valid language/region codes.',
  category: Category.development,
  groups: ['google', 'seo', 'roctify'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const findings = hreflangValidCodes(page.document);
      const elements = getHreflangLinks(page.document)
        .filter((link) => !isValidHreflang(link.hreflang))
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
