import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { charLength } from '../../lib/opengraph/text.js';

/**
 * Open Graph rule `opengraph-title-too-long` from https://www.opengraph.to/articles/title-too-long:
 * Requires og:title to be 60 characters or fewer. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-title-too-long',
  name: 'Keep og:title short',
  description: 'Requires og:title to be 60 characters or fewer.',
  slug: 'title-too-long',
  severity: Severity.warning,
  extraGroups: ['seo'],
  check(ctx) {
    const title = ctx.meta('og:title');
    return title !== null && charLength(title) > 60
      ? `The og:title is ${charLength(title)} characters long; titles longer than 60 characters may be truncated on social platforms.`
      : null;
  },
});
