import { defineOgHint } from '../../lib/opengraph/define.js';
import { twitterTitleMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `twitter-title-missing` from https://www.opengraph.to/articles/missing-twitter-title:
 * Requires a twitter:title meta tag. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'twitter-title-missing',
  name: 'Require twitter:title',
  description: 'Requires a twitter:title meta tag.',
  slug: 'missing-twitter-title',
  add: '<meta name="twitter:title" content="Your page title">',
  run: twitterTitleMissing,
});
