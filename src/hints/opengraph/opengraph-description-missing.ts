import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-description-missing` from https://www.opengraph.to/articles/missing-og-description:
 * Requires an og:description meta tag. The site classifies it as error.
 */
export default defineOgHint({
  id: 'opengraph-description-missing',
  name: 'Require og:description',
  description: 'Requires an og:description meta tag.',
  slug: 'missing-og-description',
  add: '<meta property="og:description" content="A 110 to 160 character summary of the page">',
  severity: Severity.error,
  extraGroups: ['seo'],
  check(ctx) {
    return ctx.meta('og:description') === null
      ? 'The page has no og:description meta tag so platforms show no summary under the shared link; add one of 110 to 160 characters.'
      : null;
  },
});
