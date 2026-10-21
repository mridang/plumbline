import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { siteHost } from '../../lib/network/dns-util.js';
import {
  formatCaa,
  retrieveCaa,
  MISSING_ISSUE,
} from '../../lib/network/caa.js';

/**
 * Internet.nl `caa`: the domain should publish CAA records (found by
 * climbing the DNS tree, RFC 8659) with valid syntax and at least one
 * `issue` property, so only the intended certificate authorities may issue
 * certificates. Internet.nl rates every failure as a notice (requirement
 * level: recommended), so all findings are warnings.
 */
export default defineHint({
  id: 'caa',
  name: 'CAA for domain',
  description:
    'Requires the domain to publish syntactically valid CAA records that include an issue property.',
  category: Category.security,
  groups: ['internetnl', 'dns', 'tls'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const host = siteHost(site.url);
      if (!host) {
        return;
      }
      const result = await retrieveCaa(host);
      if (!result.found) {
        site.report(site.url.href, 'Your domain does not have CAA.', {
          severity: Severity.warning,
          codeSnippet: `${host}. IN CAA 0 issue "ca.example.net"`,
        });
        return;
      }
      const found = result.records
        .map((record) => formatCaa(record, result.foundOn ?? host))
        .join('\n');
      const syntax = result.errors.filter((e) => e.id !== MISSING_ISSUE);
      if (syntax.length > 0) {
        site.report(
          site.url.href,
          `Your domain has an invalid CAA (found on ${result.foundOn}): ${syntax.map((e) => e.message).join('; ')}.`,
          { severity: Severity.warning, codeSnippet: found },
        );
      } else if (result.errors.length > 0) {
        site.report(
          site.url.href,
          `Your domain has a valid, but insufficiently protective CAA (found on ${result.foundOn}): Required 'issue' property missing.`,
          {
            severity: Severity.warning,
            codeSnippet: `${found}\n${result.foundOn ?? host}. IN CAA 0 issue "ca.example.net"`,
          },
        );
      }
    });
  },
});
