import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { timingAllowOriginFindings } from '../../lib/headers/client-hints.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Timing-Allow-Origin` names the origins allowed to read detailed
 * resource timing, or `*` for all. `*` exposes timing data to every origin
 * (a cross-origin leak), and a member that is neither `*` nor a valid origin
 * is malformed.
 */
export default defineHint({
  id: 'timing-allow-origin',
  name: 'Timing-Allow-Origin is scoped',
  description:
    'Reports Timing-Allow-Origin: * and malformed origins in the timing-exposure list.',
  category: Category.security,
  groups: ['mdn', 'security-headers', 'privacy'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Timing-Allow-Origin',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'timing-allow-origin');
      reportFindings(page, timingAllowOriginFindings(value), {
        name: 'Timing-Allow-Origin',
        value,
      });
    });
  },
});
