import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { permissionsPolicyFindings } from '../../lib/headers/permissions-policy.js';
import { reportFindings } from './shared.js';

/**
 * OWASP Secure Headers Project: `Permissions-Policy` should switch off the
 * 28 browser features the project lists (accelerometer, camera, geolocation,
 * microphone, payment, usb, ...) with an empty allowlist such as
 * `camera=()`. `sync-xhr` may also be `(self)`.
 *
 * Switching features off by default means a compromised page or an embedded
 * third party cannot use them without the site opting in.
 */
export default defineHint({
  id: 'permissions-policy',
  name: 'Permissions-Policy',
  description:
    'Requires the Permissions-Policy header to disable the browser features listed by OWASP.',
  category: Category.security,
  groups: ['owasp', 'security-headers'],
  reference: 'https://owasp.org/www-project-secure-headers/',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'permissions-policy');
      reportFindings(page, permissionsPolicyFindings(value), {
        name: 'Permissions-Policy',
        value,
      });
    });
  },
});
