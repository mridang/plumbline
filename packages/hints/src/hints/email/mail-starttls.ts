import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { mailNet } from '../../lib/email/net.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';
import { tlsVersionLevel } from '../../lib/email/smtp.js';

/**
 * Internet.nl, email test, STARTTLS: every receiving mail server (MX) must
 * offer STARTTLS on port 25 (test "STARTTLS available") and negotiate a secure
 * TLS version, TLS 1.3 (good) or TLS 1.2 (sufficient) (test "TLS version").
 * As optional requirements, the certificate chain should be complete and
 * signed by a trusted root ("Trust chain of certificate") and its domain name
 * should match the mail server ("Domain name on certificate"); these are
 * reported as warnings because many mail servers use private certificates and
 * rely on DANE instead.
 *
 * Only the version the server negotiates with a modern client is checked, not
 * every version it would accept. A server that cannot be reached, for example
 * because the network blocks outgoing port 25, is reported as information
 * instead of a failure. The hint stays silent when the site's registrable
 * domain has no MX records.
 */
export default defineHint({
  id: 'mail-starttls',
  name: 'Mail servers offer STARTTLS',
  description:
    'Requires the mail servers (MX) of the site domain to offer STARTTLS, negotiate TLS 1.2 or 1.3 and present a valid certificate.',
  category: Category.security,
  groups: ['internetnl', 'email', 'tls'],
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
      const noStarttls: string[] = [];
      const badVersion: string[] = [];
      const untrusted: string[] = [];
      const mismatched: string[] = [];
      const unreachable: string[] = [];

      for (const host of mail.hosts) {
        const probe = await mailNet.client.probeStarttls(host);
        if (!probe.reachable) {
          unreachable.push(`${host}: ${probe.error ?? 'no connection'}`);
        } else if (probe.starttls) {
          if (tlsVersionLevel(probe.tlsVersion) === 'insufficient') {
            badVersion.push(`${host}: ${probe.tlsVersion ?? 'unknown'}`);
          }
          if (!probe.trusted) {
            untrusted.push(`${host}: ${probe.trustError ?? 'untrusted'}`);
          }
          if (!probe.hostnameMatches) {
            mismatched.push(host);
          }
        } else {
          noStarttls.push(host);
        }
      }

      if (noStarttls.length > 0) {
        mail.report(
          'At least one of your mail servers does *not* offer STARTTLS.',
          {
            severity: Severity.error,
            codeSnippet: noStarttls.join('\n'),
          },
        );
      }
      if (badVersion.length > 0) {
        mail.report(
          'At least one of your mail servers supports *insufficiently* secure TLS versions.',
          { severity: Severity.error, codeSnippet: badVersion.join('\n') },
        );
      }
      if (untrusted.length > 0) {
        mail.report(
          'The trust chain of at least one of your mail server certificates is *not* complete and/or *not* signed by a trusted root certificate authority.',
          { severity: Severity.warning, codeSnippet: untrusted.join('\n') },
        );
      }
      if (mismatched.length > 0) {
        mail.report(
          'The domain name of at least one of your mail servers does *not* match the domain name on the mail server certificate.',
          { severity: Severity.warning, codeSnippet: mismatched.join('\n') },
        );
      }
      if (unreachable.length > 0) {
        mail.report(
          'Could not connect to at least one mail server on port 25, so its STARTTLS support was not checked. Outgoing port 25 is blocked on many networks.',
          { severity: Severity.hint, codeSnippet: unreachable.join('\n') },
        );
      }
    });
  },
});
