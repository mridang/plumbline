import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { isPermissiveCrossdomain } from '../../lib/exposure/detect.js';
import { fetchIfReachable, reportExposure } from './shared.js';

const WSTG =
  'https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/02-Configuration_and_Deployment_Management_Testing/08-Test_RIA_Cross_Domain_Policy';

/**
 * Probes for an overly permissive `crossdomain.xml`. This Flash/RIA policy
 * controls which origins may read the site's data; an `allow-access-from`
 * with `domain="*"` lets any origin do so. The hint reports only when the
 * body is a real `cross-domain-policy` document containing the wildcard rule,
 * so a missing file or an HTML catch-all page is not flagged. A present but
 * restrictive policy passes.
 * Source: OWASP WSTG-CONF-08 (test RIA cross-domain policy).
 */
export default defineHint({
  id: 'exposed-crossdomain',
  name: 'Overly permissive crossdomain.xml',
  description:
    'Reports when /crossdomain.xml allows access from any domain ("*").',
  category: Category.security,
  groups: ['owasp'],
  reference: WSTG,
  setup(context) {
    onSite(context, async (site) => {
      const body = await fetchIfReachable(site, '/crossdomain.xml');
      if (body !== null && isPermissiveCrossdomain(body)) {
        reportExposure(
          site,
          '/crossdomain.xml',
          'The /crossdomain.xml policy allows access from any origin (domain="*").',
          body.replace(/\s+/g, ' ').trim(),
        );
      }
    });
  },
});
