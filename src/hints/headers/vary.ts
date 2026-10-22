import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { varyFindings } from '../../lib/headers/caching.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Vary` lists the request headers a response varies on. `Vary: *` makes
 * the response uncacheable by shared caches, and mixing `*` with names is
 * contradictory. The hint checks only the shape of `Vary`; compression and
 * Accept-Encoding are covered by the dedicated HTTP-compression check.
 */
export default defineHint({
  id: 'vary',
  name: 'Vary is cache-friendly',
  description:
    'Reports Vary: * and a wildcard mixed with named headers, which defeat shared caching.',
  category: Category.performance,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'vary');
      reportFindings(page, varyFindings(value), { name: 'Vary', value });
    });
  },
});
