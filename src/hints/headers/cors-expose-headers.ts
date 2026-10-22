import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { corsExposeHeadersFindings } from '../../lib/headers/cors-extra.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Access-Control-Expose-Headers` names the response headers a script on
 * another origin may read. Exposing a wildcard or a sensitive header such as
 * `Set-Cookie` is reported.
 */
export default defineHint({
  id: 'cors-expose-headers',
  name: 'Access-Control-Expose-Headers does not leak secrets',
  description:
    'Reports a wildcard or sensitive header in the Access-Control-Expose-Headers header.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Expose-Headers',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'access-control-expose-headers');
      reportFindings(page, corsExposeHeadersFindings(value), {
        name: 'Access-Control-Expose-Headers',
        value,
      });
    });
  },
});
