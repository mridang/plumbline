import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';
import { judgeValidity, nsRpki, rpkiLines } from '../../lib/network/rpki.js';

/**
 * Internet.nl, email test, RPKI (subtest MailMxNsRpkiValid): the route
 * announcement of every IP address of the name servers of every receiving
 * mail server (MX) must have the validation state Valid. `Invalid` (a ROA
 * covers the route but does not match) and `NotFound` (no ROA) both fail, and
 * the test does not apply when none of the addresses is routed. The name
 * servers are those of the zone the MX host name lives in. The hint stays
 * silent when the site's registrable domain has no MX records.
 */
export default defineHint({
  id: 'mail-ns-rpki-valid',
  name: 'Mail server name server routes are RPKI valid',
  description:
    'Requires the route announcements of the IP addresses of the name servers of the mail servers (MX) to be RPKI valid.',
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
        const { verdict, offenders } = judgeValidity(await nsRpki(host));
        if (verdict === 'invalid') {
          mail.report(
            `${host}: At least one IP address of the name servers of your mail server has an \`Invalid\` validation state. The route announcement is *not* matched by the published RPKI Route Origin Authorisation (ROA), which indicates an unintentional or malicious route configuration error. Contact your hoster as soon as possible.`,
            { severity: Severity.error, codeSnippet: rpkiLines(offenders) },
          );
        } else if (verdict === 'bad') {
          mail.report(
            `${host}: At least one IP address of the name servers of your mail server has a \`NotFound\` validation state. There is *no* RPKI Route Origin Authorisation (ROA) published for its route announcement.`,
            { severity: Severity.error, codeSnippet: rpkiLines(offenders) },
          );
        } else {
          // Any other verdict needs no report.
        }
      }
    });
  },
});
