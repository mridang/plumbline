import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-locale-missing` from https://www.opengraph.to/articles/missing-og-locale:
 * Requires an og:locale meta tag. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-locale-missing',
  name: 'Require og:locale',
  description: 'Requires an og:locale meta tag.',
  slug: 'missing-og-locale',
  add: '<meta property="og:locale" content="en_US">',
  severity: Severity.hint,
  check(ctx) {
    return ctx.meta('og:locale') === null
      ? 'The page has no og:locale meta tag; declare the language and region, for example en_US (Facebook assumes en_US).'
      : null;
  },
});
