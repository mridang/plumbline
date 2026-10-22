import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogTypeMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-type-missing` from https://www.opengraph.to/articles/missing-og-type:
 * Requires an og:type meta tag. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-type-missing',
  name: 'Require og:type',
  description: 'Requires an og:type meta tag.',
  slug: 'missing-og-type',
  add: '<meta property="og:type" content="website">',
  run: ogTypeMissing,
});
