import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { cookieFindings } from '../../lib/headers/cookies.js';
import { hstsProtects } from '../../lib/headers/hsts.js';
import { headerValues } from '../../lib/headers/http-headers.js';
import { isSecure, reportFindings } from './shared.js';

/**
 * Cookies set by the page response (`Set-Cookie`).
 *
 * Follows Mozilla Observatory's `cookies.js`; the worst problem found is
 * reported. Every cookie should use `Secure` (a missing flag is only a
 * warning when HSTS prevents plain HTTP), session cookies (names with
 * `login` or `sess`) also need `HttpOnly`, anti-CSRF cookies (`csrf`) need
 * `SameSite`, and `SameSite` must be Strict, Lax or None, where None
 * requires `Secure`. Without `SameSite` on some cookie, advice is given.
 *
 * Cookies sent without these flags can be read by scripts, sent over
 * unencrypted connections, or attached to requests from other sites.
 */
export default defineHint({
  id: 'cookies',
  name: 'Cookie flags',
  description:
    'Checks that cookies use Secure, HttpOnly for sessions and SameSite.',
  category: Category.security,
  groups: ['observatory', 'security-headers', 'privacy'],
  reference:
    'https://developer.mozilla.org/docs/Web/Security/Practical_implementation_guides/Cookies',
  setup(context) {
    onPage(context, (page) => {
      const cookies = headerValues(page.headers, 'set-cookie');
      const protectedByHsts = hstsProtects(
        headerValue(page.headers, 'strict-transport-security'),
        isSecure(page.url),
      );
      reportFindings(page, cookieFindings(cookies, protectedByHsts), {
        name: 'Set-Cookie',
        value: cookies,
      });
    });
  },
});
