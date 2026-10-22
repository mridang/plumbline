import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { setLoginFindings } from '../../lib/headersx/fedcm.js';
import { reportFindings } from '../headers/shared.js';

/**
 * MDN: `Set-Login` is the FedCM login-status header an identity provider sends
 * to tell the browser whether a user is signed in. The only valid values are
 * `logged-in` and `logged-out`; this hint validates the value when present.
 */
export default defineHint({
  id: 'set-login',
  name: 'Set-Login has a valid login status',
  description:
    'Validates that the FedCM Set-Login header is logged-in or logged-out when present.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Login',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'set-login');
      reportFindings(page, setLoginFindings(value), {
        name: 'Set-Login',
        value,
      });
    });
  },
});
