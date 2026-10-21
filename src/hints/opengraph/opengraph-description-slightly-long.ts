import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { charLength } from '../../lib/opengraph/text.js';

/**
 * Open Graph rule `opengraph-description-slightly-long` from https://www.opengraph.to/articles/description-slightly-long:
 * Flags an og:description of 161 to 200 characters. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-description-slightly-long',
  name: 'Trim a slightly long og:description',
  description: 'Flags an og:description of 161 to 200 characters.',
  slug: 'description-slightly-long',
  at: 'og:description',
  severity: Severity.hint,
  extraGroups: ['seo'],
  check(ctx) {
    const text = ctx.meta('og:description');
    const length = text === null ? 0 : charLength(text);
    return length > 160 && length <= 200
      ? `The og:description is ${length} characters long; descriptions between 160 and 200 characters may be truncated on some platforms (aim for 110 to 160).`
      : null;
  },
});
