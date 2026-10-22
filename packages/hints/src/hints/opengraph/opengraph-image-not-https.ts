import { Category } from '../../core/define-hint.js';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogImageNotHttps } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-image-not-https` from https://www.opengraph.to/articles/image-not-https:
 * Requires the og:image URL to use HTTPS. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-image-not-https',
  name: 'Serve og:image over HTTPS',
  description: 'Requires the og:image URL to use HTTPS.',
  slug: 'image-not-https',
  at: 'og:image',
  image: true,
  category: Category.security,
  run: ogImageNotHttps,
});
