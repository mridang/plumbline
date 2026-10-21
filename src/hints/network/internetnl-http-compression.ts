import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onSite } from '../../core/page.js';
import { compression } from '../../lib/network/compression.js';

/**
 * Internet.nl `http-compression`: the web server should not compress
 * responses. HTTP compression makes HTTPS vulnerable to the BREACH attack,
 * although it is common for efficiency, so Internet.nl rates it as
 * informational (requirement level: optional) and so does this hint. Like
 * Internet.nl it only looks at the root document, offering every common
 * encoding, and flags a non-empty Content-Encoding. See NCSC-NL's TLS
 * security guidelines, paragraph 3.4.1.
 */
export default defineHint({
  id: 'internetnl-http-compression',
  name: 'HTTP compression',
  description:
    'Reports when the web server compresses the root document (BREACH risk).',
  category: Category.security,
  groups: ['internetnl', 'security-headers'],
  reference: 'https://internet.nl/',
  setup(context) {
    onSite(context, async (site) => {
      const encoding = await compression.probe(new URL('/', site.url));
      if (encoding) {
        site.report(
          site.url.href,
          `Your web server supports HTTP compression, which could be a security risk (Content-Encoding: ${encoding}).`,
          { severity: Severity.hint },
        );
      }
    });
  },
});
