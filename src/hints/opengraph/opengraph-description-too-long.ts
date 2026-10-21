import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { charLength } from '../../lib/opengraph/text.js';

/**
 * Open Graph rule `opengraph-description-too-long` from https://www.opengraph.to/articles/description-too-long:
 * Flags an og:description of more than 160 characters (the article's limit; the "slightly long" hint also covers 161 to 200 as information). The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-description-too-long',
  name: 'Keep og:description short',
  description: 'Flags an og:description of more than 160 characters.',
  slug: 'description-too-long',
  severity: Severity.warning,
  extraGroups: ['seo'],
  check(ctx) {
    const text = ctx.meta('og:description');
    // The article says the description "exceeds 160 characters"; the info-level "slightly long" hint overlaps on 161 to 200.
    return text !== null && charLength(text) > 160
      ? `The og:description is ${charLength(text)} characters long; descriptions over 160 characters may be cut off on social platforms.`
      : null;
  },
});
