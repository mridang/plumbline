import { Severity } from '@hint/utils-types';
import { defineOgHint } from '../../lib/opengraph/define.js';

/**
 * Open Graph rule `opengraph-url-missing` from https://www.opengraph.to/articles/missing-og-url:
 * Requires an og:url meta tag. The site classifies it as warning.
 */
export default defineOgHint({
  id: 'opengraph-url-missing',
  name: 'Require og:url',
  description: 'Requires an og:url meta tag.',
  slug: 'missing-og-url',
  severity: Severity.warning,
  extraGroups: ['seo'],
  check(ctx) {
    return ctx.meta('og:url') === null
      ? 'The page has no og:url meta tag; it should hold the canonical absolute HTTPS URL of the page, without tracking parameters.'
      : null;
  },
});
