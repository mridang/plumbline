import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogLocaleMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-locale-missing` from https://www.opengraph.to/articles/missing-og-locale:
 * Requires an og:locale meta tag. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-locale-missing',
  name: 'Require og:locale',
  description: 'Requires an og:locale meta tag.',
  slug: 'missing-og-locale',
  add: '<meta property="og:locale" content="en_US">',
  run: ogLocaleMissing,
});
