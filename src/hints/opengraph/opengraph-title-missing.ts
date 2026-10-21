import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-title-missing` from https://www.opengraph.to/articles/missing-og-title:
 * Requires an og:title meta tag. The site classifies it as error.
 */
export default defineOgHint({
  id: 'opengraph-title-missing',
  name: 'Require og:title',
  description: 'Requires an og:title meta tag.',
  slug: 'missing-og-title',
  severity: Severity.error,
  extraGroups: ['seo'],
  check(ctx) {
    return ctx.meta('og:title') === null
      ? 'The page has no og:title meta tag so social platforms fall back to the page title or URL; add one of 50 to 60 characters.'
      : null;
  },
});
