import { Severity } from '@hint/utils-types';
import { Category } from '../../core/define-hint.js';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-image-too-large` from https://www.opengraph.to/articles/og-image-too-large:
 * Flags an og:image over WhatsApp's 500 KB limit. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-image-too-large',
  name: 'Keep og:image under 500 KB',
  description: "Flags an og:image over WhatsApp's 500 KB limit.",
  slug: 'og-image-too-large',
  image: true,
  severity: Severity.warning,
  category: Category.performance,
  async check(ctx) {
    const image = await ctx.image();
    return image &&
      image.status >= 200 &&
      image.status < 300 &&
      image.size > 500 * 1024
      ? `The og:image is ${Math.round(image.size / 1024)} KB; WhatsApp does not show previews for images over 500 KB (aim for 200 to 400 KB).`
      : null;
  },
});
