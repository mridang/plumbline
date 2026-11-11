import { isIPv6 } from '#net';
import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { dns } from '../../core/dns.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';
import { mailNet } from '../../lib/email/net.js';

/** DNS record type number of an AAAA record. */
const AAAA = 28;

/** Mail is delivered to port 25. */
const SMTP_PORT = 25;

/**
 * Internet.nl, email test, IPv6: every receiving mail server (MX) must have an
 * AAAA record, an IPv4-mapped address (`::ffff:`) does not count, and every
 * IPv6 address must accept connections on port 25 (tests "IPv6 addresses for
 * mail server(s)" and "IPv6 reachability of mail server(s)"). The hint stays
 * silent when the site's registrable domain has no MX records.
 */
export default defineHint({
  id: 'mail-ipv6',
  name: 'Mail servers support IPv6',
  description:
    'Requires the mail servers (MX) of the site domain to have IPv6 addresses that are reachable on port 25.',
  category: Category.compatibility,
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
      const withoutIpv6: string[] = [];
      const unreachable: string[] = [];

      for (const host of mail.hosts) {
        let addresses: string[] | undefined;
        try {
          const response = await dns.client.query(host, 'AAAA');
          // A failed lookup says nothing about the server; skip it.
          if (response.status === 0 || response.status === 3) {
            addresses = response.answers
              .filter((record) => record.type === AAAA)
              .map((record) => record.data)
              // IPv4-mapped IPv6 addresses give no IPv6 connectivity.
              .filter((ip) => isIPv6(ip) && !/^::ffff:/iu.test(ip));
          }
        } catch {
          // A failed lookup says nothing about the server; skip it.
        }
        if (addresses?.length === 0) {
          withoutIpv6.push(host);
        }
        for (const ip of addresses ?? []) {
          if (!(await mailNet.client.tcpReachable(ip, SMTP_PORT))) {
            unreachable.push(`${host} ${ip}`);
          }
        }
      }

      if (withoutIpv6.length > 0) {
        mail.report(
          'At least one receiving mail server on your domain does *not* have an IPv6 address.',
          {
            severity: Severity.error,
            codeSnippet: withoutIpv6.join('\n'),
          },
        );
      }
      if (unreachable.length > 0) {
        mail.report(
          'At least one of your receiving mail servers with an IPv6 address is *not* reachable over IPv6.',
          {
            severity: Severity.error,
            codeSnippet: unreachable.join('\n'),
          },
        );
      }
    });
  },
});
