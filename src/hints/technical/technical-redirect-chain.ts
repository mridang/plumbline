import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { redirectVerdict } from '../../lib/technical/read.js';

/**
 * Warns when the page is reached through more than two redirects and errors
 * when the chain ends in an error status. Source: LLMScout "redirect-chain".
 */
export default defineHint({
  id: 'technical-redirect-chain',
  name: 'Short redirect chain',
  description:
    'Warns about long redirect chains and chains ending in an error.',
  category: Category.performance,
  groups: ['llmscout', 'seo'],
  reference: 'https://github.com/RudrenduPaul/LLMScout',
  setup(context) {
    // The target's fetch event carries the hops webhint followed.
    context.on('fetch::end::html', (event) => {
      const verdict = redirectVerdict(
        event.response.hops,
        event.response.url,
        event.response.statusCode,
      );
      if (verdict) {
        context.report(event.resource, verdict.message, {
          severity:
            verdict.severity === 'error' ? Severity.error : Severity.warning,
        });
      }
    });
  },
});
