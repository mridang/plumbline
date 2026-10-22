import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  getAlternateMediaLinks,
  isAbsoluteHttpUrl,
} from '../../lib/i18n/read.js';
import { alternateMedia, MDN_LINK_REL_REF } from '../../lib/i18n/checks.js';
import { toSeverity } from './to-severity.js';

const REF = MDN_LINK_REL_REF;

/**
 * Reports a malformed `<link rel="alternate" media="…">`.
 *
 * A media alternate (such as a separate mobile URL) needs both a non-empty
 * media query and a fully-qualified href to work. Source: MDN `rel` attribute
 * link types (warning). The predicate, message and severity live in
 * `src/lib/i18n/checks.ts`; this hint re-derives the offending elements in the
 * same order the rule emits findings.
 */

export default defineHint({
  id: 'alternate-media',
  name: 'rel=alternate media links are valid',
  description: 'Reports a malformed <link rel="alternate" media="…">.',
  category: Category.development,
  groups: ['mdn', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const findings = alternateMedia(page.document);
      const elements = getAlternateMediaLinks(page.document)
        .filter((link) => link.media === '' || !isAbsoluteHttpUrl(link.href))
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
