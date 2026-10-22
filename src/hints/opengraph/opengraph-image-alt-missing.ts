import { Category } from '../../core/define-hint.js';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogImageAltMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-image-alt-missing` from https://www.opengraph.to/articles/missing-og-image-alt:
 * Requires og:image:alt next to og:image. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-image-alt-missing',
  name: 'Describe the og:image with alt text',
  description: 'Requires og:image:alt next to og:image.',
  slug: 'missing-og-image-alt',
  add: '<meta property="og:image:alt" content="Describe the image">',
  extraGroups: ['seo'],
  category: Category.accessibility,
  run: ogImageAltMissing,
});
