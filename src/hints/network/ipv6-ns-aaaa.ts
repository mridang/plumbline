import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { siteHost } from '../../lib/network/dns-util.js';
import { judgeNsAaaa, zoneNameservers } from '../../lib/network/ipv6.js';

/**
 * Internet.nl `ns_aaaa`: the domain needs at least two name servers with an
 * IPv6 address, so resolution keeps working for IPv6-only clients and when
 * one server is down. Name servers come from the NS records of the host or
 * the nearest parent name that has any.
 */
export default defineHint({
  id: 'ipv6-ns-aaaa',
  name: 'IPv6 addresses for name servers',
  description:
    'Requires at least two name servers of the domain to have an IPv6 address.',
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
      if (servers.length === 0) {
        return;
      }
      const verdict = judgeNsAaaa(servers);
      if (verdict === 'none') {
        site.report(
          site.url.href,
          'None of the name servers of your domain has an IPv6 address.',
          { severity: Severity.error },
        );
      } else if (verdict === 'one') {
        site.report(
          site.url.href,
          'Only one name server of your domain has an IPv6 address.',
          { severity: Severity.error },
        );
      }
    });
  },
});
