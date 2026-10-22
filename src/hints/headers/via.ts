import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { viaFindings } from '../../lib/headers/info-leak.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Via` is added by proxies and gateways and often names each hop's
 * software and version. That maps the infrastructure in front of the app, so
 * the hint reports a `Via` value that discloses software names.
 */
export default defineHint({
  id: 'via',
  name: 'Via does not disclose proxy software',
  description:
    'Reports when the Via header names the proxy or gateway software in front of the site.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Via',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'via');
      reportFindings(page, viaFindings(value), { name: 'Via', value });
    });
  },
});
