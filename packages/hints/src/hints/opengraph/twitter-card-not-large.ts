import { defineOgHint } from '../../lib/opengraph/define.js';
import { twitterCardNotLarge } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `twitter-card-not-large` from https://www.opengraph.to/articles/twitter-card-not-large:
 * Suggests summary_large_image instead of summary. The site classifies it as info.
 */
export default defineOgHint({
  id: 'twitter-card-not-large',
  name: 'Prefer the large Twitter card',
  description: 'Suggests summary_large_image instead of summary.',
  slug: 'twitter-card-not-large',
  at: 'twitter:card',
  run: twitterCardNotLarge,
});
