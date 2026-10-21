import { Severity } from '@hint/utils-types';
import { Category } from '../../core/define-hint.js';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-image-dimensions-too-large` from https://www.opengraph.to/articles/og-image-dimensions-too-large:
 * Flags an og:image over 4096 pixels on a side. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-image-dimensions-too-large',
  name: 'Keep og:image dimensions reasonable',
  description: 'Flags an og:image over 4096 pixels on a side.',
  slug: 'og-image-dimensions-too-large',
  severity: Severity.warning,
  category: Category.performance,
  async check(ctx) {
    const image = await ctx.image();
    const info = image?.info;
    return info && (info.width > 4096 || info.height > 4096)
      ? `The og:image is ${info.width}x${info.height} pixels; images over 4096 pixels on a side may be rejected by platforms (use 1200x630).`
      : null;
  },
});
