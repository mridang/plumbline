import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { serverTimingFindings } from '../../lib/headers/info-leak.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Server-Timing` surfaces backend performance metrics to the browser for
 * debugging. On a production response the metric names and durations can
 * disclose internal architecture, so the hint flags its presence as advice.
 */
export default defineHint({
  id: 'server-timing',
  name: 'Server-Timing does not leak backend metrics',
  description:
    'Reports the Server-Timing header, which can expose backend metric names and timings.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server-Timing',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'server-timing');
      reportFindings(page, serverTimingFindings(value), {
        name: 'Server-Timing',
        value,
      });
    });
  },
});
