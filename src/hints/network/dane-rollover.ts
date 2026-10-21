import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { siteHost } from '../../lib/network/dns-util.js';
import {
  daneExistence,
  formatTlsa,
  hasDaneRollover,
} from '../../lib/network/dane.js';

/**
 * Internet.nl `dane-rollover` (subtest WebTlsDaneRollover): a website that
 * publishes DANE should have an active rollover scheme, at least two TLSA
 * records at `_443._tcp.<host>` so that DANE stays valid while the
 * certificate is replaced. Two DANE-EE(3) records (current and next key) or
 * a DANE-EE(3) and a DANE-TA(2) record (current key and issuer) qualify.
 * It is only tested when signed TLSA records exist, so a site without DANE
 * is left to `dane-exists`. Internet.nl rates this as a notice, so a missing
 * scheme is a warning.
 */
export default defineHint({
  id: 'dane-rollover',
  name: 'DANE rollover scheme',
  description:
    'Checks that the website domain publishes at least two TLSA records so DANE survives a certificate rollover.',
  category: Category.security,
  groups: ['internetnl', 'dns', 'tls'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const host = siteHost(site.url);
      if (!host) {
        return;
      }
      const existence = await daneExistence(host);
      if (existence.state !== 'exists' || hasDaneRollover(existence.records)) {
        return;
      }
      site.report(
        site.url.href,
        'Your website domain does *not* have a proper scheme for rolling DANE certificates: publish a second DANE-EE(3) record for the next key, or a DANE-TA(2) record for the issuer.',
        {
          severity: Severity.warning,
          codeSnippet: existence.records
            .map((record) => formatTlsa(record, `_443._tcp.${host}`))
            .join('\n'),
        },
      );
    });
  },
});
