import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogImageDimensionsMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-image-dimensions-missing` from https://www.opengraph.to/articles/missing-image-dimensions:
 * Requires og:image:width and og:image:height next to og:image. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-image-dimensions-missing',
  name: 'Declare og:image dimensions',
  description: 'Requires og:image:width and og:image:height next to og:image.',
  slug: 'missing-image-dimensions',
  add: '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">',
  run: ogImageDimensionsMissing,
});
