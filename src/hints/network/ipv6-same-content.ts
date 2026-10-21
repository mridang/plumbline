import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import {
  ipv4Addresses,
  ipv6Addresses,
  siteHost,
} from '../../lib/network/dns-util.js';
import { compareIpFamilies } from '../../lib/network/ipv6.js';

/**
 * Internet.nl `web_ipv46`: the site must look the same over IPv6 and IPv4.
 * The open ports, the status code and the HTML (nonces stripped, at most 10%
 * difference) are compared. A client error or server error status gives a
 * warning only, as does a content difference; differing ports or status
 * codes fail. Not applicable when only one address family exists.
 */
export default defineHint({
  id: 'ipv6-same-content',
  name: 'Same website on IPv6 and IPv4',
  description:
    'Requires the website over IPv6 to offer the same ports, headers and content as over IPv4.',
  category: Category.compatibility,
  groups: ['internetnl', 'dns'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const host = siteHost(site.url);
      if (!host) {
        return;
      }
      const verdict = await compareIpFamilies(
        host,
        await ipv4Addresses(host),
        await ipv6Addresses(host),
      );
      if (verdict === 'bad') {
        site.report(
          site.url.href,
          'Available ports or offered headers of your website via IPv4 are not the same via IPv6.',
          { severity: Severity.error },
        );
      } else if (verdict === 'notice') {
        site.report(
          site.url.href,
          'The HTML content of your website via IPv4 is not the same via IPv6.',
          { severity: Severity.warning },
        );
      } else if (verdict === 'notice-status-code') {
        site.report(
          site.url.href,
          'Your website via IPv6 looks identical via IPv4, but the HTTP response code is in the 4xx or 5xx range. This may indicate a configuration issue.',
          { severity: Severity.warning },
        );
      }
    });
  },
});
