import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { lastModifiedFindings } from '../../lib/headers/caching.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Last-Modified` must be a valid HTTP-date; a malformed value breaks the
 * conditional-request caching it exists for.
 */
export default defineHint({
  id: 'last-modified',
  name: 'Last-Modified is a valid date',
  description: 'Checks that the Last-Modified header is a valid HTTP-date.',
  category: Category.performance,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Last-Modified',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'last-modified');
      reportFindings(page, lastModifiedFindings(value), {
        name: 'Last-Modified',
        value,
      });
    });
  },
});
