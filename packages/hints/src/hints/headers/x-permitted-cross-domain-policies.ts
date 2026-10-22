import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { exactHeaderFindings } from '../../lib/headers/exact-header.js';
import { reportFindings } from './shared.js';

/**
 * OWASP Secure Headers Project: `X-Permitted-Cross-Domain-Policies` should
 * be `none`, so Adobe Flash and PDF clients do not load cross-domain policy
 * files that would let other sites read the visitor's data from this site.
 */
export default defineHint({
  id: 'x-permitted-cross-domain-policies',
  name: 'X-Permitted-Cross-Domain-Policies',
  description:
    'Requires the X-Permitted-Cross-Domain-Policies header to be set to none.',
  category: Category.security,
  groups: ['owasp', 'security-headers'],
  reference: 'https://owasp.org/www-project-secure-headers/',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(
        page.headers,
        'x-permitted-cross-domain-policies',
      );
      reportFindings(
        page,
        exactHeaderFindings('X-Permitted-Cross-Domain-Policies', value, [
          'none',
        ]),
        {
          name: 'X-Permitted-Cross-Domain-Policies',
          value,
          suggest: 'none',
        },
      );
    });
  },
});
