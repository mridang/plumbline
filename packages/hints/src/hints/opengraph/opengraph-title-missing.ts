import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogTitleMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-title-missing` from https://www.opengraph.to/articles/missing-og-title:
 * Requires an og:title meta tag. The site classifies it as error.
 */
export default defineOgHint({
  id: 'opengraph-title-missing',
  name: 'Require og:title',
  description: 'Requires an og:title meta tag.',
  slug: 'missing-og-title',
  add: '<meta property="og:title" content="Your page title">',
  extraGroups: ['seo', 'roctify'],
  run: ogTitleMissing,
});
