import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { nelFindings } from '../../lib/headers/reporting-extra.js';
import { reportFindings } from './shared.js';

/**
 * MDN: `NEL` (Network Error Logging) is a JSON policy. It must parse, carry a
 * `max_age` and, while active, name a `report_to` group. This validates the
 * policy's own shape, distinct from csp-reporting, which only checks where
 * reports are sent.
 */
export default defineHint({
  id: 'nel',
  name: 'NEL policy is valid',
  description:
    'Checks that the NEL header is valid JSON with a max_age and a report_to group.',
  category: Category.security,
  groups: ['mdn', 'security-headers'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/NEL',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'nel');
      reportFindings(page, nelFindings(value), { name: 'NEL', value });
    });
  },
});
