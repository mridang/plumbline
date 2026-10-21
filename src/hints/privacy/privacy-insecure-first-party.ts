import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { classifyRequests } from '../../lib/privacy/requests.js';
import { collectRequests } from './collect.js';

/**
 * Webbkoll, "Insecure first-party requests": every request to the page's own
 * registrable domain should use https. Webbkoll starts from http, follows the
 * redirects and lists each later plain http request to the same registrable
 * domain, so the check does not depend on the page's own scheme. A plain http
 * request exposes what the visitor loads and can be modified on the wire.
 */
export default defineHint({
  id: 'privacy-insecure-first-party',
  name: 'Insecure first-party requests',
  description:
    'Finds requests to the page’s own domain that use http although the page uses https.',
  category: Category.security,
  groups: ['webbkoll', 'privacy', 'security-headers'],
  reference: 'https://github.com/andersju/webbkoll',
  setup(context) {
    const collected = collectRequests(context);
    context.on('scan::end', () => {
      const result = classifyRequests(collected.pageUrl, collected.requests);
      for (const request of result.insecureFirstParty) {
        context.report(
          collected.pageUrl,
          `Insecure first-party request: ${request.url}`,
          { severity: Severity.error },
        );
      }
    });
  },
});
