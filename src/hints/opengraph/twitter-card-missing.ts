import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `twitter-card-missing` from https://www.opengraph.to/articles/missing-twitter-card:
 * Requires a twitter:card meta tag. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'twitter-card-missing',
  name: 'Require twitter:card',
  description: 'Requires a twitter:card meta tag.',
  slug: 'missing-twitter-card',
  add: '<meta name="twitter:card" content="summary_large_image">',
  severity: Severity.warning,
  check(ctx) {
    return ctx.meta('twitter:card') === null
      ? 'The page has no twitter:card meta tag so X/Twitter shows a basic link preview; use summary_large_image.'
      : null;
  },
});
