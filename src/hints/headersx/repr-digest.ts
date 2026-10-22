import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { digestFindings } from '../../lib/headersx/digest.js';
import { reportFindings } from '../headers/shared.js';

/**
 * MDN: `Repr-Digest` (RFC 9530) carries an integrity digest of the selected
 * representation (content plus its encoding) as a structured dictionary of
 * algorithm=:digest: members. This hint validates the dictionary shape when
 * present and flags digests that offer only an insecure algorithm.
 */
export default defineHint({
  id: 'repr-digest',
  name: 'Repr-Digest is a valid digest dictionary',
  description:
    'Validates the Repr-Digest header as an RFC 9530 digest dictionary when present.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Repr-Digest',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'repr-digest');
      reportFindings(page, digestFindings('Repr-Digest', value), {
        name: 'Repr-Digest',
        value,
      });
    });
  },
});
