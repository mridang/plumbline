import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { charLength } from '../../lib/opengraph/text.js';

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
  severity: Severity.hint,
  extraGroups: ['seo'],
  check(ctx) {
    const text = ctx.meta('og:description');
    const length = text === null ? 0 : charLength(text);
    return length >= 50 && length <= 70
      ? `The og:description is ${length} characters long; there is room for a more detailed description of 110 to 160 characters.`
      : null;
  },
});
