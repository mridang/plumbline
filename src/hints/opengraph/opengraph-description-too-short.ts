import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogDescriptionTooShort } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-description-too-short` from https://www.opengraph.to/articles/description-too-short:
 * Flags an og:description shorter than 50 characters. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-description-too-short',
  name: 'Expand a very short og:description',
  description: 'Flags an og:description shorter than 50 characters.',
  slug: 'description-too-short',
  at: 'og:description',
  extraGroups: ['seo'],
  run: ogDescriptionTooShort,
});
