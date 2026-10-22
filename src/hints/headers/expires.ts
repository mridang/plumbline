import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { expiresFindings } from '../../lib/headers/caching.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Expires` must be a valid HTTP-date, and it is superseded by
 * `Cache-Control: max-age` when both are present. The hint reports a malformed
 * date and notes the redundancy when max-age also appears.
 */
export default defineHint({
  id: 'expires',
  name: 'Expires is a valid date',
  description:
    'Checks that Expires is a valid HTTP-date and notes when Cache-Control max-age supersedes it.',
  category: Category.performance,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Expires',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'expires');
      const cacheControl = headerValue(page.headers, 'cache-control') ?? '';
      const hasMaxAge = /(^|,)\s*max-age\s*=/i.test(cacheControl);
      reportFindings(page, expiresFindings(value, hasMaxAge), {
        name: 'Expires',
        value,
      });
    });
  },
});
