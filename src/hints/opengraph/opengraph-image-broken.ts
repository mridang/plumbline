import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-image-broken` from https://www.opengraph.to/articles/broken-og-image:
 * Requires the og:image URL to return an image. The site classifies it as error.
 */
export default defineOgHint({
  id: 'opengraph-image-broken',
  name: 'Require a working og:image',
  description: 'Requires the og:image URL to return an image.',
  slug: 'broken-og-image',
  severity: Severity.error,
  async check(ctx) {
    const image = await ctx.image();
    if (image === null) {
      return null;
    }
    if (image.status === 0) {
      return `The og:image ${image.url} could not be fetched.`;
    }
    if (image.status < 200 || image.status >= 300) {
      return `The og:image ${image.url} returned HTTP ${image.status}.`;
    }
    return image.contentType.startsWith('image/')
      ? null
      : `The og:image ${image.url} is served as '${image.contentType || 'unknown'}', not an image.`;
  },
});
