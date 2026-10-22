import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { integrityPolicyFindings } from '../../lib/headers/reporting-extra.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Integrity-Policy` is a structured dictionary that enforces Subresource
 * Integrity, for example `blocked-destinations=(script)`. When present it must
 * declare a non-empty `blocked-destinations` inner list or the browser
 * enforces nothing.
 */
export default defineHint({
  id: 'integrity-policy',
  name: 'Integrity-Policy is well formed',
  description:
    'Checks that Integrity-Policy declares a non-empty blocked-destinations list.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Integrity-Policy',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'integrity-policy');
      reportFindings(page, integrityPolicyFindings('Integrity-Policy', value), {
        name: 'Integrity-Policy',
        value,
      });
    });
  },
});
