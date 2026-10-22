import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { breadcrumbFindings, DOCS } from '../../lib/richresults/checks.js';
import { reportRichResults } from './report.js';

/**
 * Validates every `BreadcrumbList` node in the page's JSON-LD against Google's
 * breadcrumb rich-results requirements: a non-empty `itemListElement`, and each
 * `ListItem` carrying a `position`, a `name` and an `item` URL (the `item` may
 * be omitted only on the last element, the current page). A page with no
 * BreadcrumbList node reports nothing. Source: Google Breadcrumb rich results.
 */
export default defineHint({
  id: 'richresults-breadcrumb',
  name: 'BreadcrumbList structured data is valid',
  description:
    'Validates BreadcrumbList JSON-LD (itemListElement with position and item/name) against Google rich-results rules.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: DOCS.breadcrumb,
  setup(context) {
    onPage(context, (page) => reportRichResults(page, breadcrumbFindings));
  },
});
