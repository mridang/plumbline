import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { ipv6Addresses, siteHost } from '../../lib/network/dns-util.js';

/**
 * Internet.nl `web_aaaa`: the web server needs at least one AAAA record.
 * IPv4-mapped addresses (::ffff:a.b.c.d) do not count because they give no
 * IPv6 connectivity.
 */
export default defineHint({
  id: 'ipv6-web-aaaa',
  name: 'IPv6 addresses for web server',
  description: 'Requires the web server to have at least one IPv6 address.',
  category: Category.compatibility,
  groups: ['internetnl', 'dns'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const host = siteHost(site.url);
      if (!host) {
        return;
      }
      if ((await ipv6Addresses(host)).length === 0) {
        site.report(
          site.url.href,
          'None of your web servers has an IPv6 address.',
          {
            severity: Severity.error,
            codeSnippet: `${host}. IN AAAA ; none published\n${host}. IN AAAA <IPv6 address of the web server>`,
          },
        );
      }
    });
  },
});
