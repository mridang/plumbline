import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogDescriptionCouldBeLonger } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-description-could-be-longer` from https://www.opengraph.to/articles/description-could-be-longer:
 * Flags an og:description of 50 to 70 characters. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-description-could-be-longer',
  name: 'Use more of the og:description space',
  description: 'Flags an og:description of 50 to 70 characters.',
  slug: 'description-could-be-longer',
  at: 'og:description',
  extraGroups: ['seo'],
  run: ogDescriptionCouldBeLonger,
});
