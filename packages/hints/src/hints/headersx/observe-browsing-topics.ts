import { Category, defineHint } from '../../core/define-hint.js';
import { headerValue } from '../../core/http.js';
import { onPage } from '../../core/page.js';
import { observeBrowsingTopicsFindings } from '../../lib/headersx/privacy-apis.js';
import { reportFindings } from '../headers/shared.js';

/**
 * MDN: `Observe-Browsing-Topics: ?1` opts a response into the Topics API, so
 * the browser records the page's topics for interest-based advertising. This
 * hint reports that participation when present and validates the value; it does
 * not recommend the header.
 */
export default defineHint({
  id: 'observe-browsing-topics',
  name: 'Observe-Browsing-Topics opt-in is valid',
  description:
    'Reports Topics API participation and validates the Observe-Browsing-Topics header.',
  category: Category.security,
  groups: ['mdn', 'privacy'],
  reference:
    'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Observe-Browsing-Topics',
  setup(context) {
    onPage(context, (page) => {
      const value = headerValue(page.headers, 'observe-browsing-topics');
      reportFindings(page, observeBrowsingTopicsFindings(value), {
        name: 'Observe-Browsing-Topics',
        value,
      });
    });
  },
});
