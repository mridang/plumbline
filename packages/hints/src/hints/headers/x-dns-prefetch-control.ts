import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue, headerSnippet } from '../../core/http.js';
import { onPage } from '../../core/page.js';

/**
 * OWASP Secure Headers Project: `X-DNS-Prefetch-Control` should be `off` so
 * the browser does not resolve hostnames of links ahead of a click.
 */
export default defineHint({
  id: 'x-dns-prefetch-control',
  name: 'Disable DNS prefetching',
  description: 'Requires the X-DNS-Prefetch-Control header to be set to off.',
  category: Category.security,
  groups: ['owasp', 'security-headers', 'privacy'],
  reference: 'https://owasp.org/www-project-secure-headers/',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'x-dns-prefetch-control');
      if (value === null) {
        page.report("The 'X-DNS-Prefetch-Control' header was not specified.", {
          codeLanguage: 'http',
          codeSnippet: headerSnippet('X-DNS-Prefetch-Control', 'off'),
        });
      } else if (value.toLowerCase() !== 'off') {
        page.report("The 'X-DNS-Prefetch-Control' header should be 'off'.", {
          codeLanguage: 'http',
          codeSnippet: headerSnippet('X-DNS-Prefetch-Control', value),
          severity: Severity.error,
        });
      }
    });
  },
});
