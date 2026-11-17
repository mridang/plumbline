import { Severity } from '@hint/utils-types';
import { isIPv6 } from '#net';
import { Category, defineHint } from '../../core/define-hint.js';
import { dns } from '../../core/dns.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';
import { mailNet } from '../../lib/email/net.js';

/** Matches the prefix of an IPv4-mapped IPv6 address. */
const IPV4_MAPPED_IPV6_PREFIX = /^::ffff:/iu;

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
      const found = await Array.fromAsync(mail.hosts, async (host) => {
        // A failed lookup says nothing about the server; skip it.
        const response = await dns.client.query(host, 'AAAA').catch(() => null);
        const addresses =
          response && (response.status === 0 || response.status === 3)
            ? response.answers
                .filter((record) => record.type === AAAA)
                .map((record) => record.data)
                // IPv4-mapped IPv6 addresses give no IPv6 connectivity.
                .filter((ip) => isIPv6(ip) && !IPV4_MAPPED_IPV6_PREFIX.test(ip))
            : undefined;
        const unreachableIps = await Array.fromAsync(
          addresses ?? [],
          async (ip) =>
            (await mailNet.client.tcpReachable(ip, SMTP_PORT))
              ? []
              : [`${host} ${ip}`],
        );
        return {
          withoutIpv6: addresses?.length === 0 ? [host] : [],
          unreachable: unreachableIps.flat(),
        };
      });
      const withoutIpv6 = found.flatMap((result) => result.withoutIpv6);
      const unreachable = found.flatMap((result) => result.unreachable);

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
