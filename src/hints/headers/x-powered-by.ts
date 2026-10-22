import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { xPoweredByFindings } from '../../lib/headers/info-leak.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `X-Powered-By` is a non-standard header that advertises the framework
 * or runtime behind the site. It is useless to a browser and only aids
 * reconnaissance, so the hint reports it whenever it is present.
 */
export default defineHint({
  id: 'x-powered-by',
  name: 'X-Powered-By is not sent',
  description:
    'Reports the X-Powered-By header, which reveals the technology stack to no benefit.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Powered-By',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'x-powered-by');
      reportFindings(page, xPoweredByFindings(value), {
        name: 'X-Powered-By',
        value,
      });
    });
  },
});
