import { defineOgHint } from '../../lib/opengraph/define.js';
import { ogTitleTooShort } from '../../lib/opengraph/checks.js';

/**
 * Open Graph rule `opengraph-title-too-short` from https://www.opengraph.to/articles/title-too-short:
 * Flags an og:title shorter than 15 characters. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-title-too-short',
  name: 'Make og:title descriptive',
  description: 'Flags an og:title shorter than 15 characters.',
  slug: 'title-too-short',
  at: 'og:title',
  extraGroups: ['seo'],
  run: ogTitleTooShort,
});
