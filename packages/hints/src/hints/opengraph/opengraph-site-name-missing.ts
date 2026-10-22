import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogSiteNameMissing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-site-name-missing` from https://www.opengraph.to/articles/missing-og-site-name:
 * Requires an og:site_name meta tag. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-site-name-missing',
  name: 'Require og:site_name',
  description: 'Requires an og:site_name meta tag.',
  slug: 'missing-og-site-name',
  add: '<meta property="og:site_name" content="Your site name">',
  run: ogSiteNameMissing,
});
