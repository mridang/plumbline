import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { corsMaxAgeFindings } from '../../lib/headers/cors-extra.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Access-Control-Max-Age` caches a preflight result for the given number
 * of seconds. A non-integer value is malformed, and a very large value keeps a
 * stale CORS policy in force long after the server changes it.
 */
export default defineHint({
  id: 'cors-max-age',
  name: 'Access-Control-Max-Age is reasonable',
  description:
    'Reports a malformed or excessively long Access-Control-Max-Age preflight cache.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Max-Age',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'access-control-max-age');
      reportFindings(page, corsMaxAgeFindings(value), {
        name: 'Access-Control-Max-Age',
        value,
      });
    });
  },
});
