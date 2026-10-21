import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { frameOptionsFindings } from '../../lib/headers/frame-options.js';
import { parseCspLoose } from '../../lib/headers/csp.js';
import { headerValues } from '../../lib/headers/http-headers.js';
import { PROFILE_SCHEMA, readProfile, reportFindings } from './shared.js';

/**
 * X-Frame-Options (clickjacking protection).
 *
 * `observatory` profile (default), shared by Mozilla Observatory, Webbkoll
 * and Internet.nl: `DENY` and `SAMEORIGIN` pass, `ALLOW-FROM` is obsolete
 * (browsers ignore it) and only passes with a hint to use CSP, anything else
 * is invalid, and a missing header is an error. A `frame-ancestors`
 * directive in the Content-Security-Policy header is equivalent and makes
 * the header unnecessary.
 *
 * `owasp` profile: the header must be `deny` (OWASP Secure Headers Project);
 * a CSP is not accepted instead.
 */
export default defineHint({
  id: 'x-frame-options',
  name: 'X-Frame-Options',
  description:
    'Checks that the page cannot be framed by other sites, with X-Frame-Options or CSP frame-ancestors.',
  category: Category.security,
  groups: [
    'observatory',
    'owasp',
    'webbkoll',
    'internetnl',
    'security-headers',
  ],
  reference:
    'https://developer.mozilla.org/docs/Web/Security/Attacks/Clickjacking',
  schema: PROFILE_SCHEMA,
  setup(context) {
    const profile = readProfile(context.hintOptions);
    onPage(context, (page) => {
      const header = headerValue(page.headers, 'x-frame-options');
      const cspFrameAncestors = headerValues(
        page.headers,
        'content-security-policy',
      ).some((policy) => parseCspLoose(policy).has('frame-ancestors'));
      reportFindings(
        page,
        frameOptionsFindings({ header, cspFrameAncestors, profile }),
        { name: 'X-Frame-Options', value: header },
      );
    });
  },
});
