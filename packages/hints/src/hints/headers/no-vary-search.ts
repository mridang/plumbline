import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { noVarySearchFindings } from '../../lib/headers/caching.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `No-Vary-Search` is a structured dictionary describing which URL search
 * parameters do not affect the response (`key-order`, `params`, `except`).
 * When present it must use recognised keys; the hint reports a malformed value.
 */
export default defineHint({
  id: 'no-vary-search',
  name: 'No-Vary-Search is well formed',
  description:
    'Checks that No-Vary-Search uses the recognised key-order, params or except keys.',
  category: Category.performance,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/No-Vary-Search',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'no-vary-search');
      reportFindings(page, noVarySearchFindings(value), {
        name: 'No-Vary-Search',
        value,
      });
    });
  },
});
