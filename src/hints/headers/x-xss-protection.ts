import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { analyzeCspFromHeaders } from '../../lib/headers/csp.js';
import { metaContents } from '../../lib/headers/http-headers.js';
import { xssProtectionFindings } from '../../lib/headers/xss-protection.js';
import { isSecure, reportFindings } from './shared.js';

/**
 * OWASP Secure Headers Project: the `X-XSS-Protection` header should not be
 * sent. Browsers removed the XSS auditor, and in those that kept it the
 * filter could itself be abused to leak data.
 *
 * Webbkoll's analysis of the value is used to word the finding: an invalid
 * value is reported as such, and the header is only meaningful (for legacy
 * browsers) when there is no Content-Security-Policy; with a passing CSP it
 * is plainly unnecessary. `X-XSS-Protection: 0` merely switches the filter
 * off and is reported as a warning.
 */
export default defineHint({
  id: 'x-xss-protection',
  name: 'Deprecated X-XSS-Protection header',
  description:
    'Reports the deprecated X-XSS-Protection header when it is sent.',
  category: Category.security,
  groups: ['owasp', 'webbkoll', 'security-headers'],
  reference: 'https://owasp.org/www-project-secure-headers/',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'x-xss-protection');
      if (value === null) {
        return;
      }
      const csp = analyzeCspFromHeaders(
        page.headers,
        metaContents(page.document, 'http-equiv', 'content-security-policy'),
        isSecure(page.url),
      );
      reportFindings(page, xssProtectionFindings(value, csp.pass), {
        name: 'X-XSS-Protection',
        value,
      });
    });
  },
});
