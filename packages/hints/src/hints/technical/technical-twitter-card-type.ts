import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { twitterCardType } from '../../lib/technical/read.js';
import { twitterCardTypeFindings } from '../../lib/technical/checks.js';

/**
 * Errors when twitter:card is not a recognised card type. Source: LLMScout "twitter-card" (fail).
 */
export default defineHint({
  id: 'technical-twitter-card-type',
  name: 'Twitter card type is valid',
  description:
    'Requires twitter:card to be summary, summary_large_image, app or player.',
  category: Category.development,
  groups: ['llmscout', 'seo', 'social'],
  reference: 'https://github.com/RudrenduPaul/LLMScout',
  setup(context) {
    onPage(context, (page) => {
      const type = twitterCardType(page.document);
      for (const { message, severity } of twitterCardTypeFindings(type)) {
        page.report(message, {
          severity: severity === 'error' ? Severity.error : Severity.warning,
          element: page.document.querySelector('meta[name="twitter:card" i]'),
        });
      }
    });
  },
});
