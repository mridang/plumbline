import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getHreflangLinks } from '../../lib/i18n/read.js';
import {
  hreflangDuplicate,
  GOOGLE_LOCALIZED_REF,
} from '../../lib/i18n/checks.js';
import { toSeverity } from './to-severity.js';

const REF = GOOGLE_LOCALIZED_REF;

/**
 * Reports hreflang values declared on more than one alternate.
 *
 * Two alternates claiming the same language conflict, so search engines may
 * ignore the set. Source: Google Search Central "Localized versions"
 * (warning). The predicate, message and severity live in
 * `src/lib/i18n/checks.ts`; this hint re-derives the duplicate elements (every
 * one after the first of a repeated value) in the same order the rule emits
 * findings.
 */

export default defineHint({
  id: 'hreflang-duplicate',
  name: 'hreflang values are not duplicated',
  description: 'Reports hreflang values declared on more than one alternate.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const findings = hreflangDuplicate(page.document);
      // Mirror the rule's duplicate detection: an entry is offending when the
      // same (non-empty, case-insensitive) value appears earlier in the list.
      const links = getHreflangLinks(page.document);
      const elements = links
        .filter((link, index) => {
          const key = link.hreflang.toLowerCase();
          return (
            key !== '' &&
            links.findIndex((l) => l.hreflang.toLowerCase() === key) !== index
          );
        })
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
