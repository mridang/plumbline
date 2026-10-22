import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { ageFindings } from '../../lib/headers/caching.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Age` is the time in seconds a response has been held in a cache. It
 * must be a non-negative number; the hint notes a malformed value.
 */
export default defineHint({
  id: 'age',
  name: 'Age is a valid delta-seconds',
  description:
    'Checks that the Age header is a non-negative number of seconds.',
  category: Category.performance,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Age',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'age');
      reportFindings(page, ageFindings(value), { name: 'Age', value });
    });
  },
});
