import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { dns } from '../../core/dns.js';
import { rpki } from '../../core/rpki.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';

/** DNS record type numbers of A and AAAA records. */
const ADDRESS_TYPES = new Set([1, 28]);

/**
 * Internet.nl, email test, RPKI: the route announcement of every IP address of
 * every receiving mail server (MX) must be covered by a published Route Origin
 * Authorisation (tests "Route Origin Authorisation existence" and "Route
 * announcement validity"). Without a ROA, or with an announcement that does
 * not match it, traffic to the mail server can be hijacked. Addresses without
 * a route announcement are skipped, as Internet.nl does. The hint stays
 * silent when the site's registrable domain has no MX records.
 */
export default defineHint({
  id: 'mail-rpki',
  name: 'Mail server routes have valid ROAs',
  description:
    'Requires the routes of the IP addresses of the mail servers (MX) to be covered by valid RPKI Route Origin Authorisations.',
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
      const notFound: string[] = [];
      const invalid: string[] = [];

      for (const host of mail.hosts) {
        const addresses = new Set<string>();
        for (const type of ['A', 'AAAA'] as const) {
          try {
            const response = await dns.client.query(host, type);
            for (const record of response.answers) {
              if (ADDRESS_TYPES.has(record.type)) {
                addresses.add(record.data);
              }
            }
          } catch {
            // A failed lookup leaves that family unchecked.
          }
        }
        for (const ip of addresses) {
          try {
            const result = await rpki.client.check(ip);
            if (result.asn === null) {
              // Not routed: there is nothing to validate.
              continue;
            }
            const line =
              `${host} ${ip} ${result.prefix ?? ''} AS${result.asn}`.replace(
                / +/gu,
                ' ',
              );
            if (result.status === 'invalid') {
              invalid.push(line);
            } else if (result.status === 'unknown') {
              notFound.push(line);
            }
          } catch {
            // The validation service is unavailable for this address.
          }
        }
      }

      if (notFound.length > 0) {
        mail.report(
          'At least one IP address of your receiving mail servers has a `NotFound` validation state. There is *no* RPKI Route Origin Authorization (ROA) published for the route announcement of each of the affected IP addresses.',
          { severity: Severity.error, codeSnippet: notFound.join('\n') },
        );
      }
      if (invalid.length > 0) {
        mail.report(
          "At least one IP address of your receiving mail servers has an `Invalid` validation state. The route announcement of the affected IP addresses is *not* matched by the published RPKI Route Origin Authorisation (ROA). This indicates an unintentional or malicious route configuration error, that can be caused by your mail hoster (internal error) or by a third party (external error). In either case, it increases the risk for unreachability of your server or for interception of Internet traffic to your server. Contact your mail hoster as soon as possible. In the case of an internal error, your mail hoster should ask its network provider that owns your server's IP addresses to fix the route configuration error.",
          { severity: Severity.error, codeSnippet: invalid.join('\n') },
        );
      }
    });
  },
});
