import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `twitter-card-not-large` from https://www.opengraph.to/articles/twitter-card-not-large:
 * Suggests summary_large_image instead of summary. The site classifies it as info.
 */
export default defineOgHint({
  id: 'twitter-card-not-large',
  name: 'Prefer the large Twitter card',
  description: 'Suggests summary_large_image instead of summary.',
  slug: 'twitter-card-not-large',
  severity: Severity.hint,
  check(ctx) {
    // The article only applies when an image is available; with no image a summary card is fine.
    const hasImage =
      ctx.meta('twitter:image') !== null || ctx.meta('og:image') !== null;
    return hasImage && ctx.meta('twitter:card')?.toLowerCase() === 'summary'
      ? 'The twitter:card is summary; consider summary_large_image to show a large image above the text.'
      : null;
  },
});
