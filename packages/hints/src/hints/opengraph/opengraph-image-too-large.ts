import { Category } from '../../core/define-hint.js';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogImageTooLarge } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-image-too-large` from https://www.opengraph.to/articles/og-image-too-large:
 * Flags an og:image over WhatsApp's 500 KB limit. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-image-too-large',
  name: 'Keep og:image under 500 KB',
  description: "Flags an og:image over WhatsApp's 500 KB limit.",
  slug: 'og-image-too-large',
  image: true,
  fetchImage: true,
  category: Category.performance,
  run: ogImageTooLarge,
});
