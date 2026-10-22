import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogTitleTooLong } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-title-too-long` from https://www.opengraph.to/articles/title-too-long:
 * Requires og:title to be 60 characters or fewer. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-title-too-long',
  name: 'Keep og:title short',
  description: 'Requires og:title to be 60 characters or fewer.',
  slug: 'title-too-long',
  at: 'og:title',
  extraGroups: ['seo'],
  run: ogTitleTooLong,
});
