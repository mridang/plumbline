import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `twitter-title-missing` from https://www.opengraph.to/articles/missing-twitter-title:
 * Requires a twitter:title meta tag. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'twitter-title-missing',
  name: 'Require twitter:title',
  description: 'Requires a twitter:title meta tag.',
  slug: 'missing-twitter-title',
  severity: Severity.warning,
  check(ctx) {
    return ctx.meta('twitter:title') === null
      ? 'The page has no twitter:title meta tag; X falls back to og:title or the page title, which may not suit social sharing.'
      : null;
  },
});
