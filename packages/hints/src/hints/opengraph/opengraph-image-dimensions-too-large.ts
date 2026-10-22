import { Category } from '../../core/define-hint.js';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogImageDimensionsTooLarge } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-image-dimensions-too-large` from https://www.opengraph.to/articles/og-image-dimensions-too-large:
 * Flags an og:image over 4096 pixels on a side. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-image-dimensions-too-large',
  name: 'Keep og:image dimensions reasonable',
  description: 'Flags an og:image over 4096 pixels on a side.',
  slug: 'og-image-dimensions-too-large',
  image: true,
  fetchImage: true,
  category: Category.performance,
  run: ogImageDimensionsTooLarge,
});
