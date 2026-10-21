import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { siteHost } from '../../lib/network/dns-util.js';
import { dnssecState } from '../../lib/network/dnssec.js';

/**
 * Internet.nl `dnssec exists`: the domain (its SOA record) must be DNSSEC
 * signed. A signed domain whose signatures fail validation still counts as
 * signed here; `dnssec-valid` reports that case.
 */
export default defineHint({
  id: 'dnssec-exists',
  name: 'DNSSEC existence',
  description: 'Requires the domain of the site to be DNSSEC signed.',
  category: Category.security,
  groups: ['internetnl', 'dns'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const host = siteHost(site.url);
      if (!host) {
        return;
      }
      const state = await dnssecState(host);
      if (state === 'insecure') {
        site.report(
          site.url.href,
          'Your domain is insecure, because it is not DNSSEC signed.',
          { severity: Severity.error },
        );
      } else if (state === 'servfail') {
        site.report(
          site.url.href,
          'The name servers of your domain are broken. They returned an error (SERVFAIL) to our queries for a DNSSEC signature. Please contact your name server operator (often your hosting provider and/or registrar) to fix this soon.',
          { severity: Severity.error },
        );
      } else if (state === 'error') {
        // The failure is on our side, so it is advice rather than a failure.
        site.report(
          site.url.href,
          'An error occurred in the DNS resolver while checking DNSSEC. The check could not be completed.',
          { severity: Severity.warning },
        );
      }
    });
  },
});
