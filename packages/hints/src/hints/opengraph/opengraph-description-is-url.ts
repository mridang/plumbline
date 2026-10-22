import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogDescriptionIsUrl } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-description-is-url` from https://www.opengraph.to/articles/description-is-url:
 * Flags an og:description that starts with a URL. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-description-is-url',
  name: 'Keep URLs out of og:description',
  description: 'Flags an og:description that starts with a URL.',
  slug: 'description-is-url',
  at: 'og:description',
  extraGroups: ['seo'],
  run: ogDescriptionIsUrl,
});
