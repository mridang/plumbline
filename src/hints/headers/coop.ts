import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { crossOriginFindings } from '../../lib/headers/cross-origin.js';
import { headerValues, metaContents } from '../../lib/headers/http-headers.js';
import { PROFILE_SCHEMA, readProfile, reportFindings } from './shared.js';

/**
 * Cross-Origin-Opener-Policy keeps the page in its own browsing context group so other origins cannot reach it through window.opener, which protects against cross-window attacks and enables cross-origin isolation.
 *
 * Rules are those of Mozilla Observatory (`tests/cross-origin-opener-policy.js`): a recognised value
 * passes, a missing header or the permissive default is advice, and a value
 * that cannot be recognised (or a header sent twice) is an error. With the
 * `owasp` profile the header must be exactly `same-origin` (OWASP Secure Headers
 * Project).
 */
export default defineHint({
  id: 'coop',
  name: 'Cross-Origin-Opener-Policy',
  description:
    'Checks that Cross-Origin-Opener-Policy isolates the page from windows it did not open.',
  category: Category.security,
  groups: ['observatory', 'owasp', 'security-headers'],
  reference:
    'https://developer.mozilla.org/docs/Web/HTTP/Reference/Headers/Cross-Origin-Opener-Policy',
  schema: PROFILE_SCHEMA,
  setup(context) {
    const profile = readProfile(context.hintOptions);
    onPage(context, (page) => {
      const values = headerValues(page.headers, 'cross-origin-opener-policy');
      const metas = metaContents(
        page.document,
        'http-equiv',
        'cross-origin-opener-policy',
      );
      reportFindings(
        page,
        crossOriginFindings('coop', values, metas, profile),
        {
          name: 'cross-origin-opener-policy',
          value: values.length > 0 ? values.join(', ') : null,
        },
      );
    });
  },
});
