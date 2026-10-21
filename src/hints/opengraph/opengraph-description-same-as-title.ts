import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { normalizeText } from '../../lib/opengraph/text.js';

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
  severity: Severity.warning,
  extraGroups: ['seo'],
  check(ctx) {
    const title = ctx.meta('og:title');
    const text = ctx.meta('og:description');
    return title !== null &&
      text !== null &&
      normalizeText(title) === normalizeText(text)
      ? 'The og:description is the same as the og:title; the description should add new information.'
      : null;
  },
});
