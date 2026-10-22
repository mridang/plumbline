import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { deprecatedHeaderFindings } from '../../lib/headers/exact-header.js';
import { reportFindings } from './shared.js';

/**
 * OWASP Secure Headers Project: the `Feature-Policy` header should not be sent.
 * It was renamed to Permissions-Policy in the specification.
 */
export default defineHint({
  id: 'feature-policy',
  name: 'Deprecated Feature-Policy header',
  description: 'Reports the deprecated Feature-Policy header when it is sent.',
  category: Category.security,
  groups: ['owasp', 'security-headers'],
  reference: 'https://owasp.org/www-project-secure-headers/',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'feature-policy');
      reportFindings(
        page,
        deprecatedHeaderFindings(
          'Feature-Policy',
          value,
          'it has been renamed to Permissions-Policy.',
        ),
        { name: 'Feature-Policy', value },
      );
    });
  },
});
