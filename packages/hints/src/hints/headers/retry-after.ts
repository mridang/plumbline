import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { retryAfterFindings } from '../../lib/headers/client-hints.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Retry-After` tells the client how long to wait before retrying, as a
 * delta-seconds value or an HTTP-date. It is only meaningful on a 429 or 503
 * response; elsewhere it is not applicable. When present on a relevant status
 * it must be well-formed.
 */
export default defineHint({
  id: 'retry-after',
  name: 'Retry-After is valid when meaningful',
  description:
    'Checks that Retry-After is a valid delay on a 429 or 503 response.',
  category: Category.performance,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'retry-after');
      reportFindings(page, retryAfterFindings(value, page.status), {
        name: 'Retry-After',
        value,
      });
    });
  },
});
