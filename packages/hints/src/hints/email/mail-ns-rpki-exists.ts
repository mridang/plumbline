import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';
import { missingRoa, nsRpki, rpkiLines } from '../../lib/network/rpki.js';

/**
 * Internet.nl, email test, RPKI (subtest MailMxNsRpkiExists): a Route Origin
 * Authorisation (ROA) must be published for the route announcement of every IP
 * address of the name servers of every receiving mail server (MX). Without
 * one, a forged route to the name servers that answer for the mail servers
 * cannot be filtered out. The name servers are those of the zone the MX host
 * name lives in. Addresses without a route announcement are checked as
 * Internet.nl does, as a missing ROA. The hint stays silent when the site's
 * registrable domain has no MX records.
 */
export default defineHint({
  id: 'mail-ns-rpki-exists',
  name: 'Mail server name servers have ROAs',
  description:
    'Requires an RPKI Route Origin Authorisation to be published for every IP address of the name servers of the mail servers (MX).',
  category: Category.security,
  groups: ['internetnl', 'email', 'dns'],
  reference: 'https://internet.nl/',
  schema: [
    {
      type: 'object',
      additionalProperties: false,
      properties: DOMAIN_OPTION_SCHEMA,
    },
  ],
  setup(context) {
    onMailDomain(context, async (mail) => {
      for (const host of mail.hosts) {
        const missing = missingRoa(await nsRpki(host));
        if (missing.length > 0) {
          mail.report(
            `${host}: For at least one of the IP addresses of the name servers of your mail server no RPKI Route Origin Authorisation (ROA) is published.`,
            { severity: Severity.error, codeSnippet: rpkiLines(missing) },
          );
        }
      }
    });
  },
});
