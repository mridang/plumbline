import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { dns } from '../../core/dns.js';
import { lookupTxt } from '../../lib/email/txt.js';
import { checkTlsRpt } from '../../lib/emailpolicy/tls-rpt.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onPolicyDomain,
} from '../../lib/emailpolicy/on-policy-domain.js';
import { EMAILPOLICY_GROUPS } from './groups.js';

/** Maps a library finding's severity onto webhint's enum. */
const SEVERITY = {
  error: Severity.error,
  warning: Severity.warning,
  hint: Severity.hint,
} as const;

/**
 * RFC 8460 (SMTP TLS Reporting): the site's mail domain should publish a
 * `_smtp._tls.<domain>` TXT record (`v=TLSRPTv1; rua=mailto:...|https:...`) so
 * sending servers report TLS delivery failures. This hint resolves the TXT
 * record through the injectable DNS client and validates it with the pure
 * `checkTlsRpt`. It stays silent when the site's registrable domain has no MX
 * records.
 */
export default defineHint({
  id: 'tls-rpt',
  name: 'Mail domain publishes TLS-RPT',
  description:
    'Requires the site mail domain to publish a valid TLS-RPT record with a report destination.',
  category: Category.security,
  groups: EMAILPOLICY_GROUPS,
  reference: 'https://www.rfc-editor.org/rfc/rfc8460',
  schema: [
    {
      type: 'object',
      additionalProperties: false,
      properties: DOMAIN_OPTION_SCHEMA,
    },
  ],
  setup(context) {
    onPolicyDomain(context, async (mail) => {
      const lookup = await lookupTxt(dns.client, `_smtp._tls.${mail.domain}`);
      // A failed lookup says nothing about the record; do not guess.
      if (lookup.status === 'error') {
        return;
      }
      for (const finding of checkTlsRpt(mail.domain, lookup)) {
        mail.report(finding.message, {
          severity: SEVERITY[finding.severity],
          ...(finding.codeSnippet === undefined
            ? {}
            : { codeSnippet: finding.codeSnippet }),
        });
      }
    });
  },
});
