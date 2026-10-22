import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { dns } from '../../core/dns.js';
import { lookupTxt } from '../../lib/email/txt.js';
import { checkBimi, DEFAULT_SELECTOR } from '../../lib/emailpolicy/bimi.js';
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
 * BIMI (Brand Indicators for Message Identification): the site's mail domain
 * can publish a `default._bimi.<domain>` TXT record (`v=BIMI1; l=<https svg>;
 * a=<https vmc pem>`) so mail clients show its verified logo. This hint
 * resolves the TXT record through the injectable DNS client and validates its
 * shape with the pure `checkBimi` (the logo must be an HTTPS SVG and the
 * optional certificate HTTPS). BIMI is only honoured when DMARC is enforced,
 * which a valid record carries as a note. It stays silent when the site's
 * registrable domain has no MX records.
 */
export default defineHint({
  id: 'bimi',
  name: 'Mail domain publishes a valid BIMI record',
  description:
    'Requires the site mail domain, when it publishes BIMI, to use an HTTPS SVG logo and HTTPS certificate URL.',
  category: Category.security,
  groups: EMAILPOLICY_GROUPS,
  reference: 'https://bimigroup.org',
  schema: [
    {
      type: 'object',
      additionalProperties: false,
      properties: DOMAIN_OPTION_SCHEMA,
    },
  ],
  setup(context) {
    onPolicyDomain(context, async (mail) => {
      const lookup = await lookupTxt(
        dns.client,
        `${DEFAULT_SELECTOR}._bimi.${mail.domain}`,
      );
      // A failed lookup says nothing about the record; do not guess.
      if (lookup.status === 'error') {
        return;
      }
      for (const finding of checkBimi(mail.domain, lookup)) {
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
