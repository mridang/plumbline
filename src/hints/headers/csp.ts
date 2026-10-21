import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  analyzeCspFromHeaders,
  cspFindings,
  owaspCspFindings,
} from '../../lib/headers/csp.js';
import { headerValues, metaContents } from '../../lib/headers/http-headers.js';
import {
  PROFILE_SCHEMA,
  isSecure,
  readProfile,
  reportFindings,
} from './shared.js';

/**
 * Content Security Policy.
 *
 * With the `observatory` profile (default) the policy is analysed as Mozilla
 * Observatory does, with the same result codes Webbkoll uses: missing,
 * report-only only, unparsable (including repeated directives), 'unsafe-inline'
 * or data: in script-src, overly broad object-src/script-src, http: sources on
 * an HTTPS page, 'unsafe-eval', 'unsafe-inline' in style-src, passive content
 * over HTTP and repeated report-uri/report-to. Policies from the header and
 * `<meta http-equiv>` are combined as a browser would.
 *
 * With the `owasp` profile the header must exist and must not contain the
 * substring `unsafe` (OWASP Secure Headers Project).
 *
 * A strict CSP is the main defence against cross-site scripting and a useful
 * defence against clickjacking and mixed content.
 */
export default defineHint({
  id: 'csp',
  name: 'Content Security Policy',
  description:
    'Checks that a Content Security Policy is set and does not allow unsafe sources.',
  category: Category.security,
  groups: ['observatory', 'owasp', 'webbkoll', 'security-headers'],
  reference:
    'https://developer.mozilla.org/docs/Web/Security/Practical_implementation_guides/CSP',
  schema: PROFILE_SCHEMA,
  setup(context) {
    const profile = readProfile(context.hintOptions);
    onPage(context, (page) => {
      const values = headerValues(page.headers, 'content-security-policy');
      const snippet = {
        name: 'Content-Security-Policy',
        value: values.length > 0 ? values.join(', ') : null,
      };
      if (profile === 'owasp') {
        reportFindings(page, owaspCspFindings(values), snippet);
        return;
      }
      const metas = metaContents(
        page.document,
        'http-equiv',
        'content-security-policy',
      );
      const analysis = analyzeCspFromHeaders(
        page.headers,
        metas,
        isSecure(page.url),
      );
      reportFindings(page, cspFindings(analysis), snippet);
    });
  },
});
