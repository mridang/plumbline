import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { dns } from '../../core/dns.js';
import {
  DOMAIN_OPTION_SCHEMA,
  onMailDomain,
} from '../../lib/email/on-mail-domain.js';
import {
  checkSpfPolicy,
  type SpfPolicyStatus,
} from '../../lib/email/spf-policy.js';
import { lookupTxt } from '../../lib/email/txt.js';

/** The verdict wording of Internet.nl for each failed SPF policy status. */
const POLICY_MESSAGES: Record<Exclude<SpfPolicyStatus, 'valid'>, string> = {
  invalid_syntax: 'Your SPF policy is *not* syntactically correct.',
  invalid_all: 'Your SPF policy is *not* sufficiently strict.',
  invalid_include:
    "Your SPF policy is *not* sufficiently strict. The 'include' mechanism in your SPF record points to an insufficiently strict SPF policy or a non-existing SPF record.",
  invalid_redirect:
    "Your SPF policy is *not* sufficiently strict. The 'redirect' modifier in your SPF record points to an insufficiently strict SPF policy or a non-existing SPF record.",
  max_dns_lookups:
    'Your SPF policy is *not* effective as it requires more than the allowed 10 DNS lookups. Each of the following SPF terms counts as a DNS lookup: `redirect`, `include`, `a`, `mx`, `ptr` and `exist`. The SPF terms `all`, `ip4`, `ip6` and `exp` do not count as DNS lookups.',
};

/**
 * Internet.nl, email test, authentication: the domain must have exactly one
 * SPF record (test "SPF existence") whose syntax is valid, that needs no more
 * than 10 DNS lookups and that ends in `-all` or `~all` (test "SPF policy").
 * `include` and `redirect` targets are followed; macros are not expanded. The
 * hint stays silent when the site's registrable domain has no MX records.
 */
export default defineHint({
  id: 'mail-spf',
  name: 'Mail domain has a strict SPF policy',
  description:
    'Requires the site domain to have a valid SPF record within the 10 lookup limit that ends in -all or ~all.',
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
      const lookup = await lookupTxt(dns.client, mail.domain);
      // A failed lookup says nothing about the record; do not guess.
      if (lookup.status === 'error') {
        return;
      }
      const spf =
        lookup.status === 'ok'
          ? lookup.records.filter((txt) =>
              txt.toLowerCase().startsWith('v=spf1'),
            )
          : [];
      if (spf.length !== 1) {
        mail.report('Your domain does *not* have a valid SPF record.', {
          severity: Severity.error,
          codeSnippet:
            spf.join('\n') || `${mail.domain}. IN TXT "v=spf1 mx -all"`,
        });
        return;
      }

      // Resolves the SPF record of an include or redirect target. It throws
      // when the lookup fails and gives null for none or several records.
      const resolve = async (domain: string): Promise<string | null> => {
        const found = await lookupTxt(dns.client, domain);
        if (found.status === 'error') {
          throw new Error(`lookup of ${domain} failed`);
        }
        const records =
          found.status === 'ok'
            ? found.records.filter((txt) =>
                txt.toLowerCase().startsWith('v=spf1'),
              )
            : [];
        return records.length === 1 ? records[0] : null;
      };

      const result = await checkSpfPolicy(mail.domain, spf[0], resolve);
      if (result.status !== 'valid') {
        mail.report(POLICY_MESSAGES[result.status], {
          severity: Severity.error,
          // Innermost record first, as Internet.nl shows them reversed.
          codeSnippet: [...result.records]
            .reverse()
            .map(({ domain, record }) => `${domain}: ${record}`)
            .join('\n'),
        });
      }
    });
  },
});
