import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogImageMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-image-missing` from https://www.opengraph.to/articles/missing-og-image:
 * Requires an og:image meta tag. The site classifies it as error.
 */
export default defineOgHint({
  id: 'opengraph-image-missing',
  name: 'Require og:image',
  description: 'Requires an og:image meta tag.',
  slug: 'missing-og-image',
  add: '<meta property="og:image" content="https://example.com/og-image.png">',
  run: ogImageMissing,
});
