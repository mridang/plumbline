import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { acceptPostFindings } from '../../lib/headersx/accept-method.js';
import { reportFindings } from '../headers/shared.js';

/**
 * MDN: `Accept-Post` advertises the media types a resource accepts in the body
 * of a POST request. This hint validates the media-type list when the header is
 * present.
 */
export default defineHint({
  id: 'accept-post',
  name: 'Accept-Post lists valid media types',
  description:
    'Validates the Accept-Post media-type list advertising POST body formats when present.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Post',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'accept-post');
      reportFindings(page, acceptPostFindings(value), {
        name: 'Accept-Post',
        value,
      });
    });
  },
});
