import { defineOgHint } from '../../lib/opengraph/define.js';
import { twitterSiteMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `twitter-site-missing` from https://www.opengraph.to/articles/missing-twitter-site:
 * Requires a twitter:site meta tag. The site classifies it as info.
 */
export default defineOgHint({
  id: 'twitter-site-missing',
  name: 'Require twitter:site',
  description: 'Requires a twitter:site meta tag.',
  slug: 'missing-twitter-site',
  add: '<meta name="twitter:site" content="@yourhandle">',
  run: twitterSiteMissing,
});
