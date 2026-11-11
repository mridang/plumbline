import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { siteHost } from '../../lib/network/dns-util.js';
import {
  describe,
  rpkiLines,
  judgeValidity,
  nsRpki,
} from '../../lib/network/rpki.js';

/**
 * Internet.nl `ns rpki valid`: the route announcement of every IP address
 * of the name servers must have the validation state Valid. Invalid (a ROA covers
 * the route but does not match) and NotFound (no ROA) both fail; when no
 * address is routed at all the test does not apply.
 */
export default defineHint({
  id: 'rpki-ns-valid',
  name: 'Route announcement validity for name servers',
  description:
    'Requires the route announcements of the name server IP addresses to be RPKI valid.',
  category: Category.security,
  groups: ['internetnl', 'dns'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const host = siteHost(site.url);
      if (!host) {
        return;
      }
      const { verdict, offenders } = judgeValidity(await nsRpki(host));
      if (verdict === 'invalid') {
        site.report(
          site.url.href,
          `At least one IP address of your name servers has an Invalid validation state. The route announcement of the affected IP addresses is not matched by the published RPKI Route Origin Authorisation (ROA): ${describe(offenders)}. This indicates an unintentional or malicious route configuration error. Contact your hoster as soon as possible.`,
          { severity: Severity.error, codeSnippet: rpkiLines(offenders) },
        );
      } else if (verdict === 'bad') {
        site.report(
          site.url.href,
          `At least one IP address of your name servers has a NotFound validation state. There is no RPKI Route Origin Authorisation (ROA) published for the route announcement of each of the affected IP addresses: ${describe(offenders)}.`,
          { severity: Severity.error, codeSnippet: rpkiLines(offenders) },
        );
      } else {
        // Any other verdict needs no finding.
      }
    });
  },
});
