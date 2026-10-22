import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { dns } from '../../core/dns.js';
import { lookupTxt } from '../../lib/email/txt.js';
import {
  checkMtaSts,
  policyUrl as defaultPolicyUrl,
  type PolicyFetch,
} from '../../lib/emailpolicy/mta-sts.js';
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
 * RFC 8461 (MTA-STS): the site's mail domain should advertise that mail to it
 * must travel over authenticated TLS. That needs a `_mta-sts.<domain>` TXT
 * record (`v=STSv1; id=...`) and a matching policy file fetched over HTTPS at
 * `https://mta-sts.<domain>/.well-known/mta-sts.txt` with `version`, `mode`,
 * `mx` and `max_age` fields. This hint resolves the TXT record through the
 * injectable DNS client and fetches the policy with the site's own fetch, then
 * validates both with the pure `checkMtaSts`. It stays silent when the site's
 * registrable domain has no MX records.
 */
export default defineHint({
  id: 'mta-sts',
  name: 'Mail domain enforces MTA-STS',
  description:
    'Requires the site mail domain to publish a valid MTA-STS TXT record and a matching HTTPS policy file.',
  category: Category.security,
  groups: EMAILPOLICY_GROUPS,
  reference: 'https://www.rfc-editor.org/rfc/rfc8461',
  schema: [
    {
      type: 'object',
      additionalProperties: false,
      properties: {
        ...DOMAIN_OPTION_SCHEMA,
        policyUrl: {
          type: 'string',
          description:
            'The URL of the MTA-STS policy file to fetch, instead of the standard `https://mta-sts.<domain>/.well-known/mta-sts.txt`.',
        },
      },
    },
  ],
  setup(context) {
    onPolicyDomain(context, async (mail) => {
      const lookup = await lookupTxt(dns.client, `_mta-sts.${mail.domain}`);
      // A failed lookup says nothing about the record; do not guess.
      if (lookup.status === 'error') {
        return;
      }

      const url =
        typeof mail.options.policyUrl === 'string' &&
        mail.options.policyUrl !== ''
          ? mail.options.policyUrl
          : defaultPolicyUrl(mail.domain);
      const response = await mail.fetch(url);
      const policy: PolicyFetch =
        response && response.response.statusCode < 400
          ? {
              status: 'ok',
              mediaType: response.response.mediaType,
              body: response.response.body.content,
            }
          : { status: 'missing' };

      for (const finding of checkMtaSts(mail.domain, lookup, policy)) {
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
