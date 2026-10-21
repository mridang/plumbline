import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-site-name-missing` from https://www.opengraph.to/articles/missing-og-site-name:
 * Requires an og:site_name meta tag. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-site-name-missing',
  name: 'Require og:site_name',
  description: 'Requires an og:site_name meta tag.',
  slug: 'missing-og-site-name',
  severity: Severity.hint,
  check(ctx) {
    return ctx.meta('og:site_name') === null
      ? 'The page has no og:site_name meta tag; add the brand name so platforms can identify your site.'
      : null;
  },
});
