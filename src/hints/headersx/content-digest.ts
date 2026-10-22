import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { digestFindings } from '../../lib/headersx/digest.js';
import { reportFindings } from '../headers/shared.js';

/**
 * MDN: `Content-Digest` (RFC 9530) carries an integrity digest of the message
 * content as a structured dictionary of algorithm=:digest: members. This hint
 * validates the dictionary shape when present and flags digests that offer only
 * an insecure algorithm.
 */
export default defineHint({
  id: 'content-digest',
  name: 'Content-Digest is a valid digest dictionary',
  description:
    'Validates the Content-Digest header as an RFC 9530 digest dictionary when present.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Digest',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'content-digest');
      reportFindings(page, digestFindings('Content-Digest', value), {
        name: 'Content-Digest',
        value,
      });
    });
  },
});
