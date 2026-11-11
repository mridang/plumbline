import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { dns } from '../../core/dns.js';
import { parseDkim } from '../../lib/email/dkim.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';
import { lookupTxt } from '../../lib/email/txt.js';

/**
 * Internet.nl, email test, authentication ("DKIM existence"): the domain
 * should support DKIM. Internet.nl cannot read a DKIM key because that needs
 * the selector, which only appears in the headers of sent mail, so it merely
 * checks that `_domainkey.<domain>` exists. This hint goes further when the
 * selectors are supplied through the `selectors` option: the record at
 * `<selector>._domainkey.<domain>` must exist and be a valid DKIM key record
 * (RFC 6376). Without selectors it only reports a hint saying so. The hint
 * stays silent when the site's registrable domain has no MX records.
 */
export default defineHint({
  id: 'mail-dkim',
  name: 'Mail domain publishes DKIM keys',
  description:
    'Requires the DKIM selectors given in the options to have valid key records under the site domain.',
  category: Category.security,
  groups: ['internetnl', 'email', 'dns'],
  reference: 'https://internet.nl/',
  schema: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        ...DOMAIN_OPTION_SCHEMA,
        selectors: {
          type: 'array',
          items: { type: 'string' },
          description:
            'The DKIM selectors the domain signs mail with, for example ["selector1", "google"].',
        },
      },
    },
  ],
  setup(context) {
    onMailDomain(context, async (mail) => {
      const selectors = Array.isArray(mail.options.selectors)
        ? mail.options.selectors.filter(
            (selector): selector is string =>
              typeof selector === 'string' && selector.trim() !== '',
          )
        : [];

      if (selectors.length === 0) {
        mail.report(
          'DKIM keys cannot be discovered without their selectors, which only appear in the headers of mail the domain sends. Configure the `selectors` option of this hint to check the DKIM records of the domain.',
          {
            severity: Severity.hint,
            codeSnippet: `<selector>._domainkey.${mail.domain}. IN TXT "v=DKIM1; k=rsa; p=<public key>"`,
          },
        );
        return;
      }

      for (const selector of selectors) {
        const name = `${selector.trim()}._domainkey.${mail.domain}`;
        const lookup = await lookupTxt(dns.client, name);
        const records = lookup.status === 'ok' ? lookup.records : [];
        if (lookup.status === 'error') {
          mail.report(
            `The DKIM record for selector '${selector}' could not be looked up.`,
            {
              severity: Severity.warning,
              codeSnippet: name,
            },
          );
        } else if (records.length === 0) {
          mail.report(
            `Your domain does *not* support DKIM records: there is no DKIM record for selector '${selector}'.`,
            { severity: Severity.error, codeSnippet: name },
          );
        } else if (records.length > 1) {
          mail.report(
            `The DKIM record for selector '${selector}' is ambiguous: ${records.length} TXT records were found.`,
            { severity: Severity.error, codeSnippet: records.join('\n') },
          );
        } else {
          const parsed = parseDkim(records[0]);
          if (!parsed.valid) {
            mail.report(
              `The DKIM record for selector '${selector}' is not valid: ${parsed.errors.join(' ')}`,
              { severity: Severity.error, codeSnippet: records[0] },
            );
          } else if (parsed.testing) {
            mail.report(
              `The DKIM record for selector '${selector}' is in testing mode (t=y); verifiers may ignore failures.`,
              { severity: Severity.warning, codeSnippet: records[0] },
            );
          } else {
            // A valid record outside testing mode needs no report.
          }
        }
      }
    });
  },
});
