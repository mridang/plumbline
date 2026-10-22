import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  tabnabbingFinding,
  type AnchorLike,
} from '../../lib/secplus/tabnabbing.js';
import { reportElementFinding } from './shared.js';

/**
 * Reverse tabnabbing.
 *
 * Flags every `<a target="_blank">` whose `href` points to a cross-origin
 * HTTP(S) URL without `rel="noopener"` (or `rel="noreferrer"`). Such a link
 * gives the opened page a `window.opener` handle it can use to silently
 * navigate this tab to a phishing page. The rule, message and severity live in
 * `src/lib/secplus/tabnabbing.ts`; this hint only walks the DOM and attaches
 * the offending anchor to each report.
 *
 * Source: OWASP reverse tabnabbing / MDN rel=noopener.
 */
export default defineHint({
  id: 'tabnabbing',
  name: 'No reverse tabnabbing',
  description:
    'Checks that cross-origin target="_blank" links set rel="noopener".',
  category: Category.security,
  groups: ['owasp', 'security-headers'],
  reference:
    'https://developer.mozilla.org/docs/Web/HTML/Reference/Attributes/rel/noopener',
  setup(context) {
    onPage(context, (page) => {
      // Only anchors with a `target` attribute can open a new tab; the rest
      // cannot be reverse-tabnabbing vectors.
      const anchors = [...page.document.querySelectorAll('a[target]')];
      for (const element of anchors) {
        const anchor: AnchorLike = {
          target: element.getAttribute('target'),
          rel: element.getAttribute('rel'),
          href: element.getAttribute('href'),
        };
        const found = tabnabbingFinding(anchor, page.url);
        if (found) {
          reportElementFinding(page, found, element);
        }
      }
    });
  },
});
