import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { startsWithUrl } from '../../lib/opengraph/text.js';

/**
 * Open Graph rule `opengraph-description-is-url` from https://www.opengraph.to/articles/description-is-url:
 * Flags an og:description that starts with a URL. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-description-is-url',
  name: 'Keep URLs out of og:description',
  description: 'Flags an og:description that starts with a URL.',
  slug: 'description-is-url',
  severity: Severity.warning,
  extraGroups: ['seo'],
  check(ctx) {
    const text = ctx.meta('og:description');
    return text !== null && startsWithUrl(text)
      ? 'The og:description starts with a URL; replace it with a readable summary of the page.'
      : null;
  },
});
