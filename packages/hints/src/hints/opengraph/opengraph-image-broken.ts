import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogImageBroken } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-image-broken` from https://www.opengraph.to/articles/broken-og-image:
 * Requires the og:image URL to return an image. The site classifies it as error.
 */
export default defineOgHint({
  id: 'opengraph-image-broken',
  name: 'Require a working og:image',
  description: 'Requires the og:image URL to return an image.',
  slug: 'broken-og-image',
  image: true,
  fetchImage: true,
  run: ogImageBroken,
});
