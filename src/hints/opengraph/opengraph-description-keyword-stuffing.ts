import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { hasKeywordStuffing } from '../../lib/opengraph/text.js';

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
  severity: Severity.warning,
  extraGroups: ['seo'],
  check(ctx) {
    const text = ctx.meta('og:description');
    return text !== null && hasKeywordStuffing(text)
      ? 'The og:description repeats the same word excessively, which looks spammy; write it naturally.'
      : null;
  },
});
