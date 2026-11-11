import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { looksLikeServerStatus } from '../../lib/exposure/detect.js';
import { fetchIfReachable, reportExposure } from './shared.js';

const WSTG =
  'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/05-Enumerate_Infrastructure_and_Application_Admin_Interfaces';

/**
 * Probes for Apache `mod_status` pages left open to the public. `/server-status`
 * and `/server-info` expose request URLs, client IPs, the server build and
 * loaded modules, which aid reconnaissance. The hint reports only when the
 * body carries the `Apache Server Status` / `Apache Server Information`
 * heading (or the server-version/uptime pair), so an unrelated page at the
 * path is not flagged.
 * Source: OWASP WSTG-CONF-05 (enumerate infrastructure and admin interfaces).
 */
export default defineHint({
  id: 'exposed-server-status',
  name: 'Exposed server-status page',
  description:
    'Reports when Apache /server-status or /server-info is publicly readable.',
  category: Category.security,
  groups: ['owasp'],
  reference: WSTG,
  setup(context) {
    onSite(context, async (site) => {
      for (const path of ['/server-status', '/server-info']) {
        const body = await fetchIfReachable(site, path);
        if (body !== null && looksLikeServerStatus(body)) {
          reportExposure(
            site,
            path,
            `The Apache status page ${path} is publicly readable and leaks server internals.`,
            body.replaceAll(/\s+/g, ' ').trim(),
          );
        }
      }
    });
  },
});
