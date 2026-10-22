import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogImageTooSmall } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-image-too-small` from https://www.opengraph.to/articles/og-image-too-small:
 * Flags an og:image below the minimum size of social platforms (400x256 covers every platform minimum in the article's table). The site classifies it as error.
 */
export default defineOgHint({
  id: 'opengraph-image-too-small',
  name: 'Use a large enough og:image',
  description: 'Flags an og:image below the minimum size of social platforms.',
  slug: 'og-image-too-small',
  image: true,
  fetchImage: true,
  run: ogImageTooSmall,
});
