import { defineOgHint } from '../../lib/opengraph/define.js';
import { twitterImageMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `twitter-image-missing` from https://www.opengraph.to/articles/missing-twitter-image:
 * Requires a twitter:image meta tag. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'twitter-image-missing',
  name: 'Require twitter:image',
  description: 'Requires a twitter:image meta tag.',
  slug: 'missing-twitter-image',
  add: '<meta name="twitter:image" content="https://example.com/og-image.png">',
  run: twitterImageMissing,
});
