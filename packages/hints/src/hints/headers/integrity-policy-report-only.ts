import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { integrityPolicyFindings } from '../../lib/headers/reporting-extra.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Integrity-Policy-Report-Only` is the report-only variant of
 * `Integrity-Policy`: it reports violations without blocking. It takes the
 * same structured-dictionary shape and must declare a non-empty
 * `blocked-destinations` inner list.
 */
export default defineHint({
  id: 'integrity-policy-report-only',
  name: 'Integrity-Policy-Report-Only is well formed',
  description:
    'Checks that Integrity-Policy-Report-Only declares a non-empty blocked-destinations list.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Integrity-Policy-Report-Only',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'integrity-policy-report-only');
      reportFindings(
        page,
        integrityPolicyFindings('Integrity-Policy-Report-Only', value),
        { name: 'Integrity-Policy-Report-Only', value },
      );
    });
  },
});
