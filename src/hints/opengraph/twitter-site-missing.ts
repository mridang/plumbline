import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `twitter-site-missing` from https://www.opengraph.to/articles/missing-twitter-site:
 * Requires a twitter:site meta tag. The site classifies it as info.
 */
export default defineOgHint({
  id: 'twitter-site-missing',
  name: 'Require twitter:site',
  description: 'Requires a twitter:site meta tag.',
  slug: 'missing-twitter-site',
  severity: Severity.hint,
  check(ctx) {
    return ctx.meta('twitter:site') === null
      ? 'The page has no twitter:site meta tag; add your X/Twitter handle to attribute shared content to your account.'
      : null;
  },
});
