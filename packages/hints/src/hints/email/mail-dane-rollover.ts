import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import {
  daneExistence,
  formatTlsa,
  hasDaneRollover,
} from '../../lib/network/dane.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';

/**
 * Internet.nl, email test, DANE rollover (subtest MailTlsDaneRollover): a mail
 * server that publishes DANE should have an active rollover scheme, at least
 * two TLSA records at `_25._tcp.<mx>`, so DANE stays valid while the
 * certificate is replaced and mail keeps being delivered. Two DANE-EE(3)
 * records (current and next key) or a DANE-EE(3) and a DANE-TA(2) record
 * (current key and issuer) qualify; the PKIX usages are ignored. It is only
 * tested for servers with signed TLSA records, which `mail-dane` requires.
 * Internet.nl rates it as optional information, so it is a hint. The hint
 * stays silent when the site's registrable domain has no MX records.
 */
export default defineHint({
  id: 'mail-dane-rollover',
  name: 'Mail servers have a DANE rollover scheme',
  description:
    'Checks that the mail servers (MX) of the site domain publish at least two TLSA records so DANE survives a certificate rollover.',
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
      for (const host of mail.hosts) {
        const existence = await daneExistence(host, 25);
        // Receiving mail servers must not use the PKIX usages (RFC 7672).
        const records =
          existence.state === 'exists'
            ? existence.records.filter(
                (record) => record.usage === 2 || record.usage === 3,
              )
            : [];
        if (records.length === 0 || hasDaneRollover(records)) {
          continue;
        }
        mail.report(
          `${host}: Your mail server domain does *not* have an active DANE scheme for a reliable rollover of certificate keys: publish a second DANE-EE(3) record for the next key, or a DANE-TA(2) record for the issuer.`,
          {
            severity: Severity.hint,
            codeSnippet: records
              .map((record) => formatTlsa(record, `_25._tcp.${host}`))
              .join('\n'),
          },
        );
      }
    });
  },
});
