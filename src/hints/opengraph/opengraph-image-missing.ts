import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-image-missing` from https://www.opengraph.to/articles/missing-og-image:
 * Requires an og:image meta tag. The site classifies it as error.
 */
export default defineOgHint({
  id: 'opengraph-image-missing',
  name: 'Require og:image',
  description: 'Requires an og:image meta tag.',
  slug: 'missing-og-image',
  severity: Severity.error,
  check(ctx) {
    return ctx.meta('og:image') === null
      ? 'The page has no og:image meta tag; pages without an image get significantly less engagement when shared.'
      : null;
  },
});
