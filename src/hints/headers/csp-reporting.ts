import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { headerValues } from '../../lib/headers/http-headers.js';
import { registrableDomain } from '../../lib/headers/registrable-domain.js';
import { reportingFindings } from '../../lib/headers/reporting.js';
import { reportFindings } from './shared.js';

const join = (values: string[], separator: string): string | null =>
  values.length > 0 ? values.join(separator) : null;

/**
 * Violation and error reports sent to third parties (Webbkoll's
 * `external_report`). A Content-Security-Policy or
 * Content-Security-Policy-Report-Only `report-uri`, a `report-to` group
 * defined in the `Report-To` header, and a Network Error Logging (`NEL`)
 * policy all make the visitor's browser post reports, containing page URLs
 * and details, to an endpoint. When that endpoint is on another registrable
 * domain, visitor data is shared with a third party.
 */
export default defineHint({
  id: 'csp-reporting',
  name: 'Third-party report endpoints',
  description:
    'Reports CSP, report-only and NEL report endpoints that point to a third-party domain.',
  category: Category.security,
  groups: ['webbkoll', 'security-headers', 'privacy'],
  reference: 'https://github.com/andersju/webbkoll',
  setup(context) {
    onPage(context, (page) => {
      let host = '';
      try {
        host = new URL(page.url).hostname;
      } catch {
        return;
      }
      const nel = headerValues(page.headers, 'nel');
      reportFindings(
        page,
        reportingFindings({
          registrable: registrableDomain(host),
          // Policies of repeated headers are read like one policy list.
          csp: join(
            headerValues(page.headers, 'content-security-policy'),
            '; ',
          ),
          cspReportOnly: join(
            headerValues(page.headers, 'content-security-policy-report-only'),
            '; ',
          ),
          nel: nel[0] ?? null,
          reportTo: join(headerValues(page.headers, 'report-to'), ', '),
        }),
        {
          lines: [
            'content-security-policy',
            'content-security-policy-report-only',
            'report-to',
            'nel',
          ].flatMap((name) =>
            headerValues(page.headers, name).map(
              (value) => `${name}: ${value}`,
            ),
          ),
        },
      );
    });
  },
});
