import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { corsAllowCredentialsFindings } from '../../lib/headers/cors-extra.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Access-Control-Allow-Credentials: true` lets a cross-origin request
 * carry cookies. Combined with `Access-Control-Allow-Origin: *` it is an
 * error browsers reject, and on its own it widens the attack surface. Read
 * from the main response; no preflight is sent.
 */
export default defineHint({
  id: 'cors-allow-credentials',
  name: 'Access-Control-Allow-Credentials is used safely',
  description:
    'Reports credentialed CORS access, especially when combined with a wildcard origin.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Allow-Credentials',
  setup(context) {
    onPage(context, (page) => {
      const allowCredentials = headerValue(
        page.headers,
        'access-control-allow-credentials',
      );
      const allowOrigin = headerValue(
        page.headers,
        'access-control-allow-origin',
      );
      reportFindings(
        page,
        corsAllowCredentialsFindings(allowCredentials, allowOrigin),
        { name: 'Access-Control-Allow-Credentials', value: allowCredentials },
      );
    });
  },
});
