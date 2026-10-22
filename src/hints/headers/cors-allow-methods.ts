import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { corsAllowMethodsFindings } from '../../lib/headers/cors-extra.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Access-Control-Allow-Methods` lists the methods a cross-origin request
 * may use. A wildcard (ignored for credentialed requests) or an unrecognised
 * method token is reported.
 */
export default defineHint({
  id: 'cors-allow-methods',
  name: 'Access-Control-Allow-Methods is not overly broad',
  description:
    'Reports a wildcard or unrecognised method in the Access-Control-Allow-Methods header.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Methods',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'access-control-allow-methods');
      reportFindings(page, corsAllowMethodsFindings(value), {
        name: 'Access-Control-Allow-Methods',
        value,
      });
    });
  },
});
