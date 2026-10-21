import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { charLength } from '../../lib/opengraph/text.js';

/**
 * Open Graph rule `opengraph-title-too-short` from https://www.opengraph.to/articles/title-too-short:
 * Flags an og:title shorter than 15 characters. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-title-too-short',
  name: 'Make og:title descriptive',
  description: 'Flags an og:title shorter than 15 characters.',
  slug: 'title-too-short',
  severity: Severity.hint,
  extraGroups: ['seo'],
  check(ctx) {
    const title = ctx.meta('og:title');
    return title !== null && charLength(title) < 15
      ? `The og:title is only ${charLength(title)} characters long; short titles may not be descriptive enough for social sharing (aim for 50 to 60).`
      : null;
  },
});
