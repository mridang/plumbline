import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';
import { charLength } from '../../lib/opengraph/text.js';

/**
 * Open Graph rule `opengraph-description-too-short` from https://www.opengraph.to/articles/description-too-short:
 * Flags an og:description shorter than 50 characters. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-description-too-short',
  name: 'Expand a very short og:description',
  description: 'Flags an og:description shorter than 50 characters.',
  slug: 'description-too-short',
  at: 'og:description',
  severity: Severity.hint,
  extraGroups: ['seo'],
  check(ctx) {
    const text = ctx.meta('og:description');
    return text !== null && charLength(text) < 50
      ? `The og:description is only ${charLength(text)} characters long; use two or three sentences of 110 to 160 characters to persuade people to click.`
      : null;
  },
});
