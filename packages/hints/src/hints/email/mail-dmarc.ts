import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { dns } from '../../core/dns.js';
import { checkDmarcPolicy } from '../../lib/email/dmarc-policy.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';
import { lookupTxt } from '../../lib/email/txt.js';

/**
 * Internet.nl, email test, authentication: the domain must have exactly one
 * DMARC record at `_dmarc.<domain>` (test "DMARC existence"), with valid
 * syntax, an effective policy of `quarantine` or `reject` (test mode `t=y`
 * counts one level lower) and `rua=`/`ruf=` destinations that are valid and,
 * when external, authorised to receive the reports (test "DMARC policy"). An
 * unauthorised external destination is a warning, like Internet.nl's notice.
 * The hint stays silent when the site's registrable domain has no MX records.
 */
export default defineHint({
  id: 'mail-dmarc',
  name: 'Mail domain has a strict DMARC policy',
  description:
    'Requires the site domain to publish a valid DMARC record with a policy other than none and valid report addresses.',
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
      const lookup = await lookupTxt(dns.client, `_dmarc.${mail.domain}`);
      // A failed lookup says nothing about the record; do not guess.
      if (lookup.status === 'error') {
        return;
      }
      const records =
        lookup.status === 'ok'
          ? lookup.records.filter((txt) =>
              txt.toLowerCase().startsWith('v=dmarc1'),
            )
          : [];
      if (records.length !== 1) {
        mail.report('Your domain does *not* have a DMARC record.', {
          severity: Severity.error,
          codeSnippet:
            records.join('\n') ||
            `_dmarc.${mail.domain}. IN TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@${mail.domain}"`,
        });
        return;
      }

      const status = await checkDmarcPolicy(
        records[0],
        mail.domain,
        false,
        (name) => lookupTxt(dns.client, name),
      );
      if (status === 'invalid_syntax') {
        mail.report('Your DMARC policy is *not* syntactically correct.', {
          severity: Severity.error,
          codeSnippet: records[0],
        });
      } else if (status === 'invalid_p_sp') {
        mail.report('Your DMARC policy is *not* sufficiently strict.', {
          severity: Severity.error,
          codeSnippet: records[0],
        });
      } else if (status === 'invalid_external') {
        mail.report(
          'The domain of the external mail address following `rua=` and/or `ruf=` has *no* (valid) authorisation record for receiving DMARC reports for the tested domain.',
          { severity: Severity.warning, codeSnippet: records[0] },
        );
      }
    });
  },
});
