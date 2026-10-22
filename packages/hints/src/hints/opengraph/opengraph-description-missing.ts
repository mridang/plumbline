import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogDescriptionMissing } from '../../lib/opengraph/checks.js';

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
  extraGroups: ['seo'],
  run: ogDescriptionMissing,
});
