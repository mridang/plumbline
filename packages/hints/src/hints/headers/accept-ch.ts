import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { acceptChFindings } from '../../lib/headers/client-hints.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `Accept-CH` advertises the client hints the server would like the
 * browser to send. It must be a valid token list; every requested hint also
 * widens the browser's fingerprinting surface, so a well-formed list is noted
 * as a privacy consideration.
 */
export default defineHint({
  id: 'accept-ch',
  name: 'Accept-CH is a valid client-hint list',
  description:
    'Checks the Accept-CH token list and notes that each client hint adds to fingerprinting.',
  category: Category.security,
  groups: ['mdn', 'security-headers', 'privacy'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-CH',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'accept-ch');
      reportFindings(page, acceptChFindings(value), {
        name: 'Accept-CH',
        value,
      });
    });
  },
});
