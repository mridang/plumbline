import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { ipv6Addresses, siteHost } from '../../lib/network/dns-util.js';
import { unreachableWebAddresses } from '../../lib/network/ipv6.js';

/**
 * Internet.nl `web_reach`: each IPv6 address of the web server must accept
 * a connection on port 80 or 443. Sites without an IPv6 address are left to
 * `ipv6-web-aaaa`.
 */
export default defineHint({
  id: 'ipv6-web-reach',
  name: 'IPv6 reachability of web server',
  description:
    'Requires every IPv6 address of the web server to be reachable over IPv6.',
  category: Category.compatibility,
  groups: ['internetnl', 'dns'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const host = siteHost(site.url);
      if (!host) {
        return;
      }
      const v6 = await ipv6Addresses(host);
      const bad = await unreachableWebAddresses(v6);
      if (bad.length > 0) {
        site.report(
          site.url.href,
          `At least one of your web servers with an IPv6 address is not reachable over IPv6: ${bad.join(', ')}.`,
          { severity: Severity.error },
        );
      }
    });
  },
});
