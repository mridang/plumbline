import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { serverBannerFindings } from '../../lib/headers/info-leak.js';
import { reportFindings } from './shared.js';

/**
 * MDN: the `Server` header names the software answering the request. A bare
 * product name is harmless, but a value that discloses a version or operating
 * system hands an attacker the exact build to look up known exploits for, so
 * the hint reports an over-sharing banner.
 */
export default defineHint({
  id: 'server-banner',
  name: 'Server banner does not leak a version',
  description:
    'Reports when the Server header discloses a software version or operating system.',
  category: Category.security,
  groups: ['mdn', 'security-headers', 'roctify'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Server',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'server');
      reportFindings(page, serverBannerFindings(value), {
        name: 'Server',
        value,
      });
    });
  },
});
