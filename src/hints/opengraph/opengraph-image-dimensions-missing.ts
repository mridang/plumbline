import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-image-dimensions-missing` from https://www.opengraph.to/articles/missing-image-dimensions:
 * Requires og:image:width and og:image:height next to og:image. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-image-dimensions-missing',
  name: 'Declare og:image dimensions',
  description: 'Requires og:image:width and og:image:height next to og:image.',
  slug: 'missing-image-dimensions',
  severity: Severity.warning,
  check(ctx) {
    if (ctx.meta('og:image') === null) {
      return null;
    }
    const absent = ['og:image:width', 'og:image:height'].filter(
      (key) => ctx.meta(key) === null,
    );
    return absent.length > 0
      ? `The og:image has no ${absent.join(' or ')}; declaring the size (for example 1200 by 630) avoids layout shifts and poor cropping.`
      : null;
  },
});
