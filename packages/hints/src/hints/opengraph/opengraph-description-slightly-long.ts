import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogDescriptionSlightlyLong } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-description-slightly-long` from https://www.opengraph.to/articles/description-slightly-long:
 * Flags an og:description of 161 to 200 characters. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-description-slightly-long',
  name: 'Trim a slightly long og:description',
  description: 'Flags an og:description of 161 to 200 characters.',
  slug: 'description-slightly-long',
  at: 'og:description',
  extraGroups: ['seo'],
  run: ogDescriptionSlightlyLong,
});
