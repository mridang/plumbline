import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogDescriptionKeywordStuffing } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-description-keyword-stuffing` from https://www.opengraph.to/articles/description-keyword-stuffing:
 * Flags an og:description that repeats the same word excessively. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-description-keyword-stuffing',
  name: 'Avoid keyword stuffing in og:description',
  description:
    'Flags an og:description that repeats the same word excessively.',
  slug: 'description-keyword-stuffing',
  at: 'og:description',
  extraGroups: ['seo'],
  run: ogDescriptionKeywordStuffing,
});
