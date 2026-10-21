import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `twitter-description-missing` from https://www.opengraph.to/articles/missing-twitter-description:
 * Requires a twitter:description meta tag. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'twitter-description-missing',
  name: 'Require twitter:description',
  description: 'Requires a twitter:description meta tag.',
  slug: 'missing-twitter-description',
  add: '<meta name="twitter:description" content="A short summary of the page">',
  severity: Severity.warning,
  check(ctx) {
    return ctx.meta('twitter:description') === null
      ? 'The page has no twitter:description meta tag; X falls back to og:description or the meta description.'
      : null;
  },
});
