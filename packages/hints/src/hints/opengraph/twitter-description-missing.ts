import { defineOgHint } from '../../lib/opengraph/define.js';
import { twitterDescriptionMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `twitter-description-missing` from https://www.opengraph.to/articles/missing-twitter-description:
 * Requires a twitter:description meta tag. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'twitter-description-missing',
  name: 'Require twitter:description',
  description: 'Requires a twitter:description meta tag.',
  slug: 'missing-twitter-description',
  add: '<meta name="twitter:description" content="A short summary of the page">',
  run: twitterDescriptionMissing,
});
