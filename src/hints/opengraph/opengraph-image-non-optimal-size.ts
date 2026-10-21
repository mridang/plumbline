import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-image-non-optimal-size` from https://www.opengraph.to/articles/non-optimal-image-size:
 * Flags an og:image that is not 1200x630 pixels (1.91:1); 1200x628 and 2400x1260 are also accepted. The site classifies it as info.
 */
export default defineOgHint({
  id: 'opengraph-image-non-optimal-size',
  name: 'Use the recommended og:image size',
  description: 'Flags an og:image that is not 1200x630 pixels (1.91:1).',
  slug: 'non-optimal-image-size',
  severity: Severity.hint,
  async check(ctx) {
    const image = await ctx.image();
    const info = image?.info;
    if (!info) {
      return null;
    }
    // The article triggers when the size differs from 1200x630 and gives no tolerance. Its own table also lists 1200x628 (X) and mentions 2400x1260 as a high-DPI option, so those three pass.
    const accepted = [
      [1200, 630],
      [1200, 628],
      [2400, 1260],
    ];
    return accepted.some(([w, h]) => info.width === w && info.height === h)
      ? null
      : `The og:image is ${info.width}x${info.height} pixels; use 1200x630 (1.91:1) to avoid cropping, scaling or letterboxing.`;
  },
});
