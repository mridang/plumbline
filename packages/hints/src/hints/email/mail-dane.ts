import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { dns } from '../../core/dns.js';
import { mailNet } from '../../lib/email/net.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';
import {
  TLSA,
  isDaneUsage,
  parseTlsa,
  tlsaMatches,
  type TlsaRecord,
} from '../../lib/email/tlsa.js';

/**
 * Internet.nl, email test, DANE: every receiving mail server (MX) must
 * publish a DNSSEC-signed TLSA record at `_25._tcp.<mx>` (test "DANE
 * existence"), and at least one record must match the certificate the server
 * presents over STARTTLS (test "DANE validity"). TLSA records of the PKIX
 * usages (0 and 1) are ignored because receiving mail servers should not use
 * them. DANE needs DNSSEC, so an unsigned answer counts as missing. When the
 * server cannot be reached the match is not checked and a hint says so. The
 * hint stays silent when the site's registrable domain has no MX records.
 */
export default defineHint({
  id: 'mail-dane',
  name: 'Mail servers publish valid DANE records',
  description:
    'Requires the mail servers (MX) of the site domain to publish DNSSEC-signed TLSA records that match their certificates.',
  category: Category.security,
  groups: ['internetnl', 'email', 'dns', 'tls'],
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
      const missing: string[] = [];
      const bogus: string[] = [];
      const invalid: string[] = [];
      const unchecked: string[] = [];

      // eslint-disable-next-line sonarjs/too-many-break-or-continue-in-loop -- four early exits; restructuring them would reindent the whole per-host check
      for (const host of mail.hosts) {
        let records: TlsaRecord[] = [];
        try {
          const response = await dns.client.query(`_25._tcp.${host}`, 'TLSA');
          if (response.status === 2) {
            bogus.push(host);
            continue;
          }
          // DANE is only usable with DNSSEC; an unsigned answer is no answer.
          if (response.authenticated) {
            records = response.answers
              .filter((record) => record.type === TLSA)
              .flatMap((record) => parseTlsa(record.data) ?? [])
              .filter(isDaneUsage);
          }
        } catch {
          continue;
        }
        if (records.length === 0) {
          missing.push(host);
          continue;
        }

        const probe = await mailNet.client.probeStarttls(host);
        if (!probe.starttls || probe.certificates.length === 0) {
          unchecked.push(
            `${host}: ${probe.error ?? 'no certificate presented'}`,
          );
          continue;
        }
        if (
          !records.some((record) => tlsaMatches(record, probe.certificates))
        ) {
          invalid.push(host);
        }
      }

      if (missing.length > 0) {
        mail.report(
          'At least one of your mail server domains does *not* provide a TLSA record for DANE.',
          {
            severity: Severity.error,
            codeSnippet: missing
              .map(
                (host) =>
                  `_25._tcp.${host}. IN TLSA 3 1 1 <SHA-256 of the certificate public key>`,
              )
              .join('\n'),
          },
        );
      }
      if (bogus.length > 0) {
        mail.report(
          'At least one of your mail server domains does *not* provide DNSSEC proof that DANE TLSA records do not exist. This could lead to non-deliverability of mail sent to you by DANE validating mail senders. You should ask your name server operator to fix this issue.',
          {
            severity: Severity.error,
            codeSnippet: bogus
              .map((host) => `_25._tcp.${host}. IN TLSA ; SERVFAIL`)
              .join('\n'),
          },
        );
      }
      if (invalid.length > 0) {
        mail.report(
          'At least one of your mail servers does *not* have any valid DANE fingerprints. Either someone manipulated the response of your mail server, or your mail server has a serious DANE configuration error. The latter makes your domain unreachable for any sending mail server that checks DANE fingerprints. You should contact your mail provider as soon as possible.',
          { severity: Severity.error, codeSnippet: invalid.join('\n') },
        );
      }
      if (unchecked.length > 0) {
        mail.report(
          'The DANE fingerprints of at least one mail server were not checked, because its certificate could not be retrieved over STARTTLS on port 25.',
          { severity: Severity.hint, codeSnippet: unchecked.join('\n') },
        );
      }
    });
  },
});
