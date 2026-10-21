import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { siteHost } from '../../lib/network/dns-util.js';
import { dnssecState } from '../../lib/network/dnssec.js';

/**
 * Internet.nl `dnssec valid`: the DNSSEC signature of the domain must be
 * valid (the domain is "secure"). Unsigned domains and broken name servers
 * are reported by `dnssec-exists`, not here. Internet.nl's extra notice for
 * DS algorithms its resolver does not support cannot be told apart through
 * a DNS-over-HTTPS resolver and is not ported.
 */
export default defineHint({
  id: 'dnssec-valid',
  name: 'DNSSEC validity',
  description: 'Requires the DNSSEC signature of the domain to be valid.',
  category: Category.security,
  groups: ['internetnl', 'dns'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const host = siteHost(site.url);
      if (!host) {
        return;
      }
      if ((await dnssecState(host)) === 'bogus') {
        site.report(
          site.url.href,
          "Your domain is 'bogus', because the DNSSEC signature is not valid. Either someone manipulated the response from your name server, or your domain has a serious DNSSEC configuration error. The latter makes your domain unreachable for any user who validates DNSSEC signatures. You should contact your name server operator (often your registrar or hosting provider) as soon as possible.",
          { severity: Severity.error },
        );
      }
    });
  },
});
