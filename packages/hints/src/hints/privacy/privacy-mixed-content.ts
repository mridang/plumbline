import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { classifyRequests } from '../../lib/privacy/requests.js';
import { collectRequests, evidence } from './collect.js';

/**
 * Webbkoll, "HTTPS by default, but with issues": an https page must not load
 * subresources over http (mixed content,
 * https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content).
 * Scripts, stylesheets, frames and fonts are active content and an error;
 * images and media are passive content and a warning. Both the requests that
 * were made and the URLs written in the HTML are checked.
 */
export default defineHint({
  id: 'privacy-mixed-content',
  name: 'Mixed content',
  description:
    'Finds insecure subresources loaded by a page served over https.',
  category: Category.security,
  groups: ['webbkoll', 'privacy', 'security-headers', 'roctify'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content',
  setup(context) {
    const collected = collectRequests(context);
    context.on('scan::end', () => {
      // Requests win over declarations: they carry the real resource type.
      const all = [...collected.requests, ...collected.declared];
      const unique = all.filter(
        (request, index) =>
          all.findIndex((other) => other.url === request.url) === index,
      );
      const { mixedContent } = classifyRequests(collected.pageUrl, unique);
      const groups = [
        [mixedContent.active, Severity.error, 'active'],
        [mixedContent.passive, Severity.warning, 'passive'],
      ] as const;
      for (const [requests, severity, kind] of groups) {
        for (const request of requests) {
          context.report(
            request.url,
            `The page contains ${kind} mixed content: ${request.type} loaded over http from ${request.url}`,
            {
              severity,
              ...evidence(collected, request.url),
            },
          );
        }
      }
    });
  },
});
