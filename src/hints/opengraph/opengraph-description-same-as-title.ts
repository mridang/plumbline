import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogDescriptionSameAsTitle } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-description-same-as-title` from https://www.opengraph.to/articles/description-same-as-title:
 * Flags an og:description identical to the og:title. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-description-same-as-title',
  name: 'Differ og:description from og:title',
  description: 'Flags an og:description identical to the og:title.',
  slug: 'description-same-as-title',
  at: 'og:description',
  extraGroups: ['seo'],
  run: ogDescriptionSameAsTitle,
});
