import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogImageNonOptimalSize } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-image-non-optimal-size` from https://www.opengraph.to/articles/non-optimal-image-size:
 * Flags an og:image that is not 1200x630 pixels (1.91:1); 1200x628 and 2400x1260 are also accepted. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-image-non-optimal-size',
  name: 'Use the recommended og:image size',
  description: 'Flags an og:image that is not 1200x630 pixels (1.91:1).',
  slug: 'non-optimal-image-size',
  image: true,
  fetchImage: true,
  run: ogImageNonOptimalSize,
});
