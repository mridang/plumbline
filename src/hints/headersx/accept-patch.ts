import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { acceptPatchFindings } from '../../lib/headersx/accept-method.js';
import { reportFindings } from '../headers/shared.js';

/**
 * MDN: `Accept-Patch` advertises the media types a resource accepts in the body
 * of a PATCH request (sent on an OPTIONS or 405 response). This hint validates
 * the media-type list when the header is present.
 */
export default defineHint({
  id: 'accept-patch',
  name: 'Accept-Patch lists valid media types',
  description:
    'Validates the Accept-Patch media-type list advertising PATCH body formats when present.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept-Patch',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'accept-patch');
      reportFindings(page, acceptPatchFindings(value), {
        name: 'Accept-Patch',
        value,
      });
    });
  },
});
