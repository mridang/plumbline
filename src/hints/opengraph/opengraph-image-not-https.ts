import { Severity } from '@hint/utils-types';
import { Category } from '../../core/define-hint.js';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-image-not-https` from https://www.opengraph.to/articles/image-not-https:
 * Requires the og:image URL to use HTTPS. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-image-not-https',
  name: 'Serve og:image over HTTPS',
  description: 'Requires the og:image URL to use HTTPS.',
  slug: 'image-not-https',
  severity: Severity.warning,
  category: Category.security,
  check(ctx) {
    const src = ctx.meta('og:image');
    return src !== null && /^http:\/\//i.test(src)
      ? 'The og:image URL uses http://; some platforms block non-HTTPS images, so switch to https://.'
      : null;
  },
});
