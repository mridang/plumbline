import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { dns } from '../../core/dns.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';

type ZoneState = 'secure' | 'insecure' | 'bogus' | 'unknown';

/**
 * Asks a validating resolver for the SOA of a name, as Internet.nl does. An
 * answer with the AD flag is `secure`, one without is `insecure`, and
 * SERVFAIL is what a validating resolver returns for a broken (`bogus`)
 * signature, so it is reported as such.
 */
async function zoneState(name: string): Promise<ZoneState> {
  try {
    const response = await dns.client.query(name, 'SOA');
    if (response.status === 2) {
      return 'bogus';
    }
    return response.authenticated ? 'secure' : 'insecure';
  } catch {
    return 'unknown';
  }
}

/**
 * Internet.nl, email test, DNSSEC: the domain of the email address and the
 * domains of its mail servers (MX) must be DNSSEC signed with a valid
 * signature (tests "DNSSEC existence" and "DNSSEC validity"). Senders who
 * validate DNSSEC can then trust the MX answer and the addresses and DANE
 * records of the mail servers. The hint stays silent when the site's
 * registrable domain has no MX records.
 */
export default defineHint({
  id: 'mail-dnssec',
  name: 'Mail domains are DNSSEC signed',
  description:
    'Requires the site domain and the domains of its mail servers (MX) to be DNSSEC signed with a valid signature.',
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
      const domainState = await zoneState(mail.domain);
      if (domainState === 'insecure') {
        mail.report(
          'Your email address domain is insecure, because it is *not* DNSSEC signed.',
          { severity: Severity.error, codeSnippet: mail.domain },
        );
      } else if (domainState === 'bogus') {
        mail.report(
          "Your email address domain is 'bogus', because the DNSSEC signature is *not* valid (the validating resolver answered SERVFAIL). Either someone manipulated the response from your name server, or your domain has a *serious DNSSEC configuration error*. The latter makes your domain unreachable for any user who validates DNSSEC signatures. You should contact your name server operator (often your registrar or hosting provider) as soon as possible.",
          { severity: Severity.error, codeSnippet: mail.domain },
        );
      } else {
        // Any other state needs no report.
      }

      const insecure: string[] = [];
      const bogus: string[] = [];
      for (const host of mail.hosts) {
        const state = await zoneState(host);
        if (state === 'insecure') {
          insecure.push(host);
        } else if (state === 'bogus') {
          bogus.push(host);
        } else {
          // Any other state needs no report.
        }
      }
      if (insecure.length > 0) {
        mail.report(
          'At least one of your mail server domains is insecure, because it is *not* DNSSEC signed.',
          { severity: Severity.error, codeSnippet: insecure.join('\n') },
        );
      }
      if (bogus.length > 0) {
        mail.report(
          "At least one of your signed mail server domains is 'bogus', because its DNSSEC signature is not valid (the validating resolver answered SERVFAIL). Either someone manipulated the responses from its name servers, or your mail server domain has serious DNSSEC configuration errors. The latter makes your receiving mail server unreachable for any sending mail server that validates DNSSEC signatures. You should contact the name server operator (often your mail provider) as soon as possible.",
          { severity: Severity.error, codeSnippet: bogus.join('\n') },
        );
      }
    });
  },
});
