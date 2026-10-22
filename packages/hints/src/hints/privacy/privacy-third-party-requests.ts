import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { classifyRequests } from '../../lib/privacy/requests.js';
import { collectRequests } from './collect.js';

/**
 * Webbkoll, "Third-party requests": lists the requests made to domains other
 * than the page's own registrable domain or its subdomains, since each one
 * tells another party that the visitor is on the page (GDPR rec. 69 and 70,
 * art. 5.1.b-c and 25). The count, the secure/insecure split, the types and
 * the unique hosts are reported; hosts are listed without any labels. Insecure
 * third-party requests are a warning, the rest is information.
 */
export default defineHint({
  id: 'privacy-third-party-requests',
  name: 'Third-party requests',
  description:
    'Lists requests to hosts outside the page’s registrable domain, by host and type.',
  category: Category.security,
  groups: ['webbkoll', 'privacy'],
  reference: 'https://github.com/andersju/webbkoll',
  setup(context) {
    const collected = collectRequests(context);
    context.on('scan::end', () => {
      const result = classifyRequests(collected.pageUrl, collected.requests);
      const total = result.thirdParty.length;
      if (total === 0) {
        return;
      }
      const types = Object.entries(result.byType)
        .map(([type, count]) => `${type}: ${count}`)
        .join(', ');
      const counts = new Map<string, number>();
      for (const request of result.thirdParty) {
        const host = new URL(request.url).hostname.toLowerCase();
        counts.set(host, (counts.get(host) ?? 0) + 1);
      }
      const hosts = [...counts]
        .map(([host, count]) => `${host}: ${count}`)
        .join('\n');
      context.report(
        collected.pageUrl,
        `${total} third-party ${total === 1 ? 'request' : 'requests'} ` +
          `(${result.secure} secure, ${result.insecure} insecure) to ` +
          `${result.thirdPartyHosts.length} unique ` +
          `${result.thirdPartyHosts.length === 1 ? 'host' : 'hosts'}: ` +
          `${result.thirdPartyHosts.join(', ')}. By type: ${types}. ` +
          `A third-party request is a request to a domain that is not ` +
          `${result.pageDomain} or one of its subdomains.`,
        {
          severity: result.insecure > 0 ? Severity.warning : Severity.hint,
          codeSnippet: hosts,
        },
      );
    });
  },
});
