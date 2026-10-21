import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-image-too-small` from https://www.opengraph.to/articles/og-image-too-small:
 * Flags an og:image below the minimum size of social platforms (400x256 covers every platform minimum in the article's table). The site classifies it as error.
 */
export default defineOgHint({
  id: 'opengraph-image-too-small',
  name: 'Use a large enough og:image',
  description: 'Flags an og:image below the minimum size of social platforms.',
  slug: 'og-image-too-small',
  severity: Severity.error,
  async check(ctx) {
    const image = await ctx.image();
    const info = image?.info;
    // The article's per-platform minimums: Facebook 200x200, X 300x157, WhatsApp ~300x200, Slack ~400x200, Discord 256x256 (Telegram has none).
    // LinkedIn's listed 1200x628 equals its recommendation, not a hard minimum, so it is left out. Meeting every other minimum means at least 400x256.
    return info && (info.width < 400 || info.height < 256)
      ? `The og:image is ${info.width}x${info.height} pixels, below the minimum of one or more social platforms (at least 400x256 is needed); use 1200x630.`
      : null;
  },
});
