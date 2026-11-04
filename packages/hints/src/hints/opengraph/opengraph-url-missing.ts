import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogUrlMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-url-missing` from https://www.opengraph.to/articles/missing-og-url:
 * Requires an og:url meta tag. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-url-missing',
  name: 'Require og:url',
  description: 'Requires an og:url meta tag.',
  slug: 'missing-og-url',
  add: '<meta property="og:url" content="https://example.com/page">',
  extraGroups: ['seo', 'roctify'],
  run: ogUrlMissing,
});
