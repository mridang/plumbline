import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { reportingEndpointsFindings } from '../../lib/headers/reporting-extra.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Reporting-Endpoints` maps endpoint names to the https URL reports are
 * posted to, as a structured dictionary. Every value must be a quoted absolute
 * https URL; the hint reports a malformed entry so the configuration is not
 * silently ignored.
 */
export default defineHint({
  id: 'reporting-endpoints',
  name: 'Reporting-Endpoints is well formed',
  description:
    'Checks that Reporting-Endpoints maps endpoint names to quoted absolute https URLs.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Reporting-Endpoints',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'reporting-endpoints');
      reportFindings(page, reportingEndpointsFindings(value), {
        name: 'Reporting-Endpoints',
        value,
      });
    });
  },
});
