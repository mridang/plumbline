import { defineOgHint } from '../../lib/opengraph/define.js';
import { twitterCardMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `twitter-card-missing` from https://www.opengraph.to/articles/missing-twitter-card:
 * Requires a twitter:card meta tag. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'twitter-card-missing',
  name: 'Require twitter:card',
  description: 'Requires a twitter:card meta tag.',
  slug: 'missing-twitter-card',
  add: '<meta name="twitter:card" content="summary_large_image">',
  extraGroups: ['roctify'],
  run: twitterCardMissing,
});
