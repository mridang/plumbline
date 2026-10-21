import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { deprecatedHeaderFindings } from '../../lib/headers/exact-header.js';
import { reportFindings } from './shared.js';

/**
 * OWASP Secure Headers Project: the `Expect-CT` header should not be sent.
 * Since 2018 certificates carry certificate transparency proofs by default, so the header became obsolete.
 */
export default defineHint({
  id: 'expect-ct',
  name: 'Deprecated Expect-CT header',
  description: 'Reports the deprecated Expect-CT header when it is sent.',
  category: Category.security,
  groups: ['owasp', 'security-headers'],
  reference: 'https://owasp.org/www-project-secure-headers/',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'expect-ct');
      reportFindings(
        page,
        deprecatedHeaderFindings(
          'Expect-CT',
          value,
          'certificate transparency is enforced by default and the header is obsolete.',
        ),
        { name: 'Expect-CT', value },
      );
    });
  },
});
