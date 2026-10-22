import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogDescriptionTooLong } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-description-too-long` from https://www.opengraph.to/articles/description-too-long:
 * Flags an og:description of more than 160 characters (the article's limit; the "slightly long" hint also covers 161 to 200 as information). The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-description-too-long',
  name: 'Keep og:description short',
  description: 'Flags an og:description of more than 160 characters.',
  slug: 'description-too-long',
  at: 'og:description',
  extraGroups: ['seo'],
  run: ogDescriptionTooLong,
});
