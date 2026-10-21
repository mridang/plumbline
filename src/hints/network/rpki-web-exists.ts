import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { siteHost } from '../../lib/network/dns-util.js';
import { describe, webRpki, missingRoa } from '../../lib/network/rpki.js';

/**
 * Internet.nl `web rpki exists`: an RPKI Route Origin Authorisation (ROA)
 * must be published for every IP address of the web server. Without a ROA, a
 * forged BGP route announcement cannot be filtered out. Internet.nl rates a
 * missing ROA as a notice, so it is reported as a warning.
 */
export default defineHint({
  id: 'rpki-web-exists',
  name: 'Route Origin Authorisation existence for web server',
  description:
    'Requires an RPKI ROA to be published for every IP address of the web server.',
  category: Category.security,
  groups: ['internetnl', 'dns'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const host = siteHost(site.url);
      if (!host) {
        return;
      }
      const missing = missingRoa(await webRpki(host));
      if (missing.length > 0) {
        site.report(
          site.url.href,
          `For at least one of the IP addresses of your web server no RPKI Route Origin Authorisation (ROA) is published: ${describe(missing)}.`,
          { severity: Severity.warning },
        );
      }
    });
  },
});
