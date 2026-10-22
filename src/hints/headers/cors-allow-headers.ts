import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { corsAllowHeadersFindings } from '../../lib/headers/cors-extra.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Access-Control-Allow-Headers` lists the request headers a cross-origin
 * request may send. A wildcard is ignored for credentialed requests and
 * otherwise grants more than almost any resource needs, so it is reported.
 */
export default defineHint({
  id: 'cors-allow-headers',
  name: 'Access-Control-Allow-Headers is not a wildcard',
  description:
    'Reports a wildcard Access-Control-Allow-Headers, which allows every request header.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Headers',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'access-control-allow-headers');
      reportFindings(page, corsAllowHeadersFindings(value), {
        name: 'Access-Control-Allow-Headers',
        value,
      });
    });
  },
});
