import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { altSvcFindings } from '../../lib/headers/client-hints.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Alt-Svc` advertises alternative services such as HTTP/2 or HTTP/3 for
 * the origin. It is informational: `clear` withdraws all alternatives, a
 * well-formed list is surfaced as information, and anything else is reported as
 * malformed.
 */
export default defineHint({
  id: 'alt-svc',
  name: 'Alt-Svc is well formed',
  description:
    'Reports the advertised alternative services and flags a malformed Alt-Svc value.',
  category: Category.performance,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Alt-Svc',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'alt-svc');
      reportFindings(page, altSvcFindings(value), { name: 'Alt-Svc', value });
    });
  },
});
