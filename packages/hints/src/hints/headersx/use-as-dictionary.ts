import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { compressionDictionaryFindings } from '../../lib/headersx/compression.js';
import { reportFindings } from '../headers/shared.js';

/**
 * MDN: `Use-As-Dictionary` advertises that a response may serve as a
 * compression dictionary (Compression Dictionary Transport). It is a structured
 * dictionary whose required `match` member names the requests it applies to.
 * This hint validates the dictionary when the header is present.
 */
export default defineHint({
  id: 'use-as-dictionary',
  name: 'Use-As-Dictionary is a valid dictionary',
  description:
    'Validates the Use-As-Dictionary compression-dictionary header, requiring a match pattern, when present.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Use-As-Dictionary',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'use-as-dictionary');
      reportFindings(page, compressionDictionaryFindings(value), {
        name: 'Use-As-Dictionary',
        value,
      });
    });
  },
});
