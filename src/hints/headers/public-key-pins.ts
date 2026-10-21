import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { deprecatedHeaderFindings } from '../../lib/headers/exact-header.js';
import { reportFindings } from './shared.js';

/**
 * OWASP Secure Headers Project: the `Public-Key-Pins` header should not be sent.
 * All major browsers dropped HPKP; a wrong pin can lock visitors out of the site for months.
 */
export default defineHint({
  id: 'public-key-pins',
  name: 'Deprecated Public-Key-Pins header',
  description: 'Reports the deprecated Public-Key-Pins header when it is sent.',
  category: Category.security,
  groups: ['owasp', 'security-headers'],
  reference: 'https://owasp.org/www-project-secure-headers/',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'public-key-pins');
      reportFindings(
        page,
        deprecatedHeaderFindings(
          'Public-Key-Pins',
          value,
          'it has been removed from all major browsers and is no longer recommended.',
        ),
        { name: 'Public-Key-Pins', value },
      );
    });
  },
});
