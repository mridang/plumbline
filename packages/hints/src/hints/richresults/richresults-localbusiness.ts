import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { localBusinessFindings, DOCS } from '../../lib/richresults/checks.js';
import { reportRichResults } from './report.js';

/**
 * Validates every `LocalBusiness` node (and its subtypes) in the page's JSON-LD
 * against Google's local-business rich-results requirements: `name` and
 * `address` are required (a missing one is an error) and `openingHours` and
 * `telephone` are recommended. A page with no LocalBusiness node reports
 * nothing. Source: Google Local business rich results.
 */
export default defineHint({
  id: 'richresults-localbusiness',
  name: 'LocalBusiness structured data is valid',
  description:
    'Validates LocalBusiness JSON-LD (name, address) against Google rich-results required and recommended properties.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: DOCS.localbusiness,
  setup(context) {
    onPage(context, (page) => reportRichResults(page, localBusinessFindings));
  },
});
