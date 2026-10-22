import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { attributionReportingFindings } from '../../lib/headersx/privacy-apis.js';
import { reportFindings } from '../headers/shared.js';

/**
 * MDN: the `Attribution-Reporting-Register-Source` and
 * `Attribution-Reporting-Register-Trigger` headers register a response with the
 * Attribution Reporting API (the Privacy Sandbox's cookieless ad measurement).
 * This hint reports that the response takes part and validates the JSON
 * registration; it does not recommend the headers.
 */
export default defineHint({
  id: 'attribution-reporting',
  name: 'Attribution Reporting registration is valid',
  description:
    'Reports participation in the Attribution Reporting API and validates the registration headers.',
  category: Category.security,
  groups: ['mdn', 'privacy'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Attribution-Reporting-Register-Source',
  setup(context) {
    onPage(context, (page) => {
      const source = headerValue(
        page.headers,
        'attribution-reporting-register-source',
      );
      const trigger = headerValue(
        page.headers,
        'attribution-reporting-register-trigger',
      );
      reportFindings(page, attributionReportingFindings(source, trigger));
    });
  },
});
