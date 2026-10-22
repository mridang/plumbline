import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { cookiePrefixFindings } from '../../lib/secplus/cookie-prefixes.js';
import { headerValues } from '../../lib/headers/http-headers.js';
import { reportFindings } from '../headers/shared.js';

/**
 * Cookie name-prefix correctness.
 *
 * Distinct from the `cookies` hint, which checks the general
 * Secure/HttpOnly/SameSite hygiene. This hint checks only the prefix contract
 * the browser enforces: a `__Host-` cookie must be Secure, have `Path=/` and
 * set no `Domain`; a `__Secure-` cookie must be Secure. A cookie that breaks
 * its prefix is silently rejected by the browser, so a mismatch drops the
 * cookie entirely. The rules, messages and severities live in
 * `src/lib/secplus/cookie-prefixes.ts`.
 *
 * Source: RFC 6265bis cookie prefixes / MDN Set-Cookie.
 */
export default defineHint({
  id: 'cookie-prefixes',
  name: 'Correct cookie prefixes',
  description:
    'Checks that __Host- and __Secure- cookies meet their prefix requirements.',
  category: Category.security,
  groups: ['owasp', 'security-headers'],
  reference:
    'https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Set-Cookie#cookie_prefixes',
  setup(context) {
    onPage(context, (page) => {
      const cookies = headerValues(page.headers, 'set-cookie');
      reportFindings(page, cookiePrefixFindings(cookies), {
        name: 'Set-Cookie',
        value: cookies,
      });
    });
  },
});
