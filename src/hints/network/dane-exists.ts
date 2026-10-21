import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { siteHost } from '../../lib/network/dns-util.js';
import { daneExistence } from '../../lib/network/dane.js';

/**
 * Internet.nl `dane-exists`: a DNSSEC signed TLSA record should exist for
 * `_443._tcp.<host>`. DNSSEC is a precondition for DANE, so unsigned TLSA
 * records count as missing. Internet.nl rates a missing record as
 * informational; a lookup that fails DNSSEC validation is an error.
 */
export default defineHint({
  id: 'dane-exists',
  name: 'DANE existence',
  description:
    'Checks that the website domain publishes a signed TLSA record for DANE.',
  category: Category.security,
  groups: ['internetnl', 'dns', 'tls'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const host = siteHost(site.url);
      if (!host) {
        return;
      }
      const result = await daneExistence(host);
      if (result.state === 'none') {
        site.report(
          site.url.href,
          'Your website domain does not contain a TLSA record for DANE.',
          { severity: Severity.hint },
        );
      } else if (result.state === 'bogus') {
        site.report(
          site.url.href,
          'Your website domain does not provide DNSSEC proof that DANE TLSA records do not exist. You should ask your name server operator to fix this issue.',
          { severity: Severity.error },
        );
      }
    });
  },
});
