import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { cacheControlFindings } from '../../lib/headers/cache-control.js';
import { reportFindings } from './shared.js';

/**
 * OWASP Secure Headers Project: `Cache-Control: no-store, max-age=0`, so
 * browsers and proxies never keep a copy of the response.
 *
 * This is meant for private applications whose pages differ per user. On a
 * public, cacheable site it would switch caching off for everything, so the
 * check is opt-in: it does nothing unless the option `enforce` is `true`.
 */
export default defineHint({
  id: 'cache-control',
  name: 'Cache-Control for private pages',
  description:
    'Requires Cache-Control: no-store, max-age=0 on private applications (opt-in with the enforce option).',
  category: Category.security,
  groups: ['owasp', 'security-headers'],
  reference: 'https://owasp.org/www-project-secure-headers/',
  schema: [
    {
      additionalProperties: false,
      properties: { enforce: { type: 'boolean' } },
      type: 'object',
    },
  ],
  setup(context) {
    const enforce =
      (context.hintOptions as { enforce?: boolean } | undefined)?.enforce ===
      true;
    if (!enforce) {
      return;
    }
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'cache-control');
      reportFindings(page, cacheControlFindings(value), {
        name: 'Cache-Control',
        value,
        suggest: 'no-store, max-age=0',
      });
    });
  },
});
