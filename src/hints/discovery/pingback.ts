import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import {
  domRelLinks,
  headerRelLinks,
  type RelLink,
} from '../../lib/discovery/links.js';
import { pingbackFindings } from '../../lib/discovery/pingback.js';
import { reportFindings } from '../headers/shared.js';

/**
 * Pingback: a legacy XML-RPC linkback advertised with
 * `<link rel="pingback">` or an `X-Pingback` header. Its open endpoint is a
 * known spam and amplification vector, so this hint flags it as legacy when
 * present and recommends Webmention.
 */
export default defineHint({
  id: 'pingback',
  name: 'Pingback endpoint (legacy)',
  description:
    'Flags a Pingback endpoint as a legacy spam/amplification risk when present.',
  category: Category.development,
  groups: ['original', 'social'],
  reference: 'https://www.hixie.ch/specs/pingback/pingback',
  setup(context) {
    onPage(context, (page) => {
      const links: RelLink[] = [
        ...domRelLinks(page.document),
        ...headerRelLinks(headerValue(page.headers, 'link')),
      ];
      reportFindings(
        page,
        pingbackFindings(links, headerValue(page.headers, 'x-pingback')),
      );
    });
  },
});
