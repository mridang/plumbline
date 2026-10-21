import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `twitter-image-missing` from https://www.opengraph.to/articles/missing-twitter-image:
 * Requires a twitter:image meta tag. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'twitter-image-missing',
  name: 'Require twitter:image',
  description: 'Requires a twitter:image meta tag.',
  slug: 'missing-twitter-image',
  add: '<meta name="twitter:image" content="https://example.com/og-image.png">',
  severity: Severity.warning,
  check(ctx) {
    // The article fires only when neither twitter:image nor the og:image fallback exists.
    return ctx.meta('twitter:image') === null && ctx.meta('og:image') === null
      ? 'The page has no twitter:image meta tag and no og:image to fall back on, so X shows a plain link with no preview image.'
      : null;
  },
});
