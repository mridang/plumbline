import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { siteHost } from '../../lib/network/dns-util.js';
import {
  unreachableNameservers,
  zoneNameservers,
} from '../../lib/network/ipv6.js';

/**
 * Internet.nl `ns_reach`: every name server that has an AAAA record must be
 * reachable over IPv6 (on port 53). A published but dead IPv6 address makes
 * resolvers wait for a timeout before they fall back to IPv4.
 */
export default defineHint({
  id: 'ipv6-ns-reach',
  name: 'IPv6 reachability of name servers',
  description:
    'Requires every name server with an IPv6 address to be reachable over IPv6.',
  category: Category.compatibility,
  groups: ['internetnl', 'dns'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const host = siteHost(site.url);
      if (!host) {
        return;
      }
      const { servers } = await zoneNameservers(host);
      const bad = await unreachableNameservers(servers);
      if (bad.length > 0) {
        const detail = bad
          .map((b) => `${b.name} (${b.ips.join(', ')})`)
          .join('; ');
        site.report(
          site.url.href,
          `Not all name servers that have an IPv6 address are reachable over IPv6: ${detail}.`,
          {
            severity: Severity.error,
            codeSnippet: bad
              .flatMap((b) =>
                b.ips.map(
                  (ip) => `${b.name}. AAAA ${ip} ; port 53 unreachable`,
                ),
              )
              .join('\n'),
          },
        );
      }
    });
  },
});
