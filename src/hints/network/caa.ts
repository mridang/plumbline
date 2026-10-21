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
 * Looks up the CAA records of `host` and reports what is wrong with them.
 * `owner` is what the records protect in the message, `domain` for the
 * website and `mail server` for an MX host; every finding is a warning.
 */
export async function checkCaa(
  host: string,
  owner: string,
  report: (message: string, codeSnippet: string) => void,
): Promise<void> {
  const result = await retrieveCaa(host);
  if (!result.found) {
    report(
      `Your ${owner} does not have CAA.`,
      `${host}. IN CAA 0 issue "ca.example.net"`,
    );
    return;
  }
  const found = result.records
    .map((record) => formatCaa(record, result.foundOn ?? host))
    .join('\n');
  const syntax = result.errors.filter((e) => e.id !== MISSING_ISSUE);
  if (syntax.length > 0) {
    report(
      `Your ${owner} has an invalid CAA (found on ${result.foundOn}): ${syntax.map((e) => e.message).join('; ')}.`,
      found,
    );
  } else if (result.errors.length > 0) {
    report(
      `Your ${owner} has a valid, but insufficiently protective CAA (found on ${result.foundOn}): Required 'issue' property missing.`,
      `${found}\n${result.foundOn ?? host}. IN CAA 0 issue "ca.example.net"`,
    );
  }
}

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
      await checkCaa(host, 'domain', (message, codeSnippet) =>
        site.report(site.url.href, message, {
          severity: Severity.warning,
          codeSnippet,
        }),
      );
    });
  },
});
