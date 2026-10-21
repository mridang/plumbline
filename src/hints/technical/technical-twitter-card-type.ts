import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  TWITTER_CARD_TYPES,
  twitterCardType,
} from '../../lib/technical/read.js';

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
      if (type !== null && !TWITTER_CARD_TYPES.includes(type as never)) {
        page.report(
          `twitter:card value "${type}" is not a recognized card type. Use one of: ${TWITTER_CARD_TYPES.join(', ')}.`,
          {
            severity: Severity.error,
            element: page.document.querySelector('meta[name="twitter:card" i]'),
          },
        );
      }
    });
  },
});
