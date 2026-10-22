import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import {
  domRelLinks,
  headerRelLinks,
  type RelLink,
} from '../../lib/discovery/links.js';
import { webmentionFindings } from '../../lib/discovery/webmention.js';
import { reportFindings } from '../headers/shared.js';

/**
 * W3C Webmention: a receiver advertises its endpoint with
 * `<link rel="webmention">` or a `Link` header relation. This hint reports the
 * endpoint it finds (in the DOM or the `Link` header) and warns when the
 * endpoint is missing or is not an absolute URL.
 */
export default defineHint({
  id: 'webmention',
  name: 'Webmention endpoint',
  description:
    'Reports a Webmention endpoint and warns when it is not an absolute URL (W3C Webmention).',
  category: Category.development,
  groups: ['w3c', 'social'],
  reference: 'https://www.w3.org/TR/webmention/',
  setup(context) {
    onPage(context, (page) => {
      const links: RelLink[] = [
        ...domRelLinks(page.document),
        ...headerRelLinks(headerValue(page.headers, 'link')),
      ];
      reportFindings(page, webmentionFindings(links));
    });
  },
});
