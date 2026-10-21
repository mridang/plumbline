import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';
import { checkCaa } from '../network/caa.js';

/**
 * Internet.nl, email test, subtest MailCaa: every receiving mail server (MX)
 * should be covered by CAA records (found by climbing the DNS tree from the
 * MX host name, RFC 8659) with valid syntax and at least one `issue`
 * property, so only the intended certificate authorities may issue
 * certificates for it. It is the check of the website hint `caa`, run for each
 * MX host name; Internet.nl rates every failure as a notice (recommended), so
 * all findings are warnings. The hint stays silent when the site's
 * registrable domain has no MX records.
 */
export default defineHint({
  id: 'mail-caa',
  name: 'Mail servers have CAA',
  description:
    'Requires the mail servers (MX) of the site domain to be covered by syntactically valid CAA records with an issue property.',
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
        await checkCaa(host, 'mail server', (message, codeSnippet) =>
          mail.report(`${host}: ${message}`, {
            severity: Severity.warning,
            codeSnippet,
          }),
        );
      }
    });
  },
});
