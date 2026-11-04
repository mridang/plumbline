import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { exactHeaderFindings } from '../../lib/headers/exact-header.js';
import { reportFindings } from './shared.js';

/**
 * Mozilla Observatory: `X-Content-Type-Options` must be `nosniff`, so a
 * browser does not guess a response into a content type the server did not
 * declare. Also a check of the Roctify SEO checker ("MIME sniffing
 * protection").
 */
export default defineHint({
  id: 'x-content-type-options',
  name: 'X-Content-Type-Options',
  description: 'Requires the X-Content-Type-Options header to be nosniff.',
  category: Category.security,
  groups: ['observatory', 'roctify', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'x-content-type-options');
      reportFindings(
        page,
        exactHeaderFindings('X-Content-Type-Options', value, ['nosniff']),
        { name: 'X-Content-Type-Options', value, suggest: 'nosniff' },
      );
    });
  },
});
