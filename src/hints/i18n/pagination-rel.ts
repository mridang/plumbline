import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { getPaginationLinks, isAbsoluteHttpUrl } from '../../lib/i18n/read.js';
import { paginationRel, MDN_LINK_REL_REF } from '../../lib/i18n/checks.js';
import { toSeverity } from './to-severity.js';

const REF = MDN_LINK_REL_REF;

/**
 * Reports `rel=prev`/`rel=next` links with a missing or non-absolute URL.
 *
 * When a page declares pagination relations they must resolve to real,
 * fully-qualified pages. Source: MDN `rel` attribute link types (warning). The
 * predicate, message and severity live in `src/lib/i18n/checks.ts`; this hint
 * re-derives the offending elements in the same order the rule emits findings
 * (all `prev` first, then `next`).
 */

export default defineHint({
  id: 'pagination-rel',
  name: 'rel=prev/next links are well-formed',
  description:
    'Reports rel=prev/rel=next links with a missing or non-absolute URL.',
  category: Category.development,
  groups: ['mdn', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const findings = paginationRel(page.document);
      const elements = getPaginationLinks(page.document)
        .filter((link) => !isAbsoluteHttpUrl(link.href))
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
