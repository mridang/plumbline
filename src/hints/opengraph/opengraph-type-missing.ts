import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-type-missing` from https://www.opengraph.to/articles/missing-og-type:
 * Requires an og:type meta tag. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-type-missing',
  name: 'Require og:type',
  description: 'Requires an og:type meta tag.',
  slug: 'missing-og-type',
  add: '<meta property="og:type" content="website">',
  severity: Severity.hint,
  check(ctx) {
    return ctx.meta('og:type') === null
      ? 'The page has no og:type meta tag; declare the content type, using website by default or article for written content.'
      : null;
  },
});
