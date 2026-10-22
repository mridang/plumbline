import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { criticalChFindings } from '../../lib/headers/client-hints.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Critical-CH` marks client hints as critical so the browser retries a
 * request that lacked them. Every critical hint must also appear in
 * `Accept-CH`, or it is never requested; the hint reports an orphaned hint.
 */
export default defineHint({
  id: 'critical-ch',
  name: 'Critical-CH is a subset of Accept-CH',
  description:
    'Checks that every hint in Critical-CH is also advertised in Accept-CH.',
  category: Category.security,
  groups: ['mdn', 'security-headers', 'privacy'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Critical-CH',
  setup(context) {
    onPage(context, (page) => {
      const critical = headerValue(page.headers, 'critical-ch');
      const acceptCh = headerValue(page.headers, 'accept-ch');
      reportFindings(page, criticalChFindings(critical, acceptCh), {
        name: 'Critical-CH',
        value: critical,
      });
    });
  },
});
