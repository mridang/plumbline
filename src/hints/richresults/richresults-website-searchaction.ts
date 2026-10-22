import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  websiteSearchActionFindings,
  DOCS,
} from '../../lib/richresults/checks.js';
import { reportRichResults } from './report.js';

/**
 * Validates the sitelinks search box: a `WebSite` node whose `potentialAction`
 * is a `SearchAction` must carry a `target` and a `query-input`. A WebSite with
 * no SearchAction reports nothing (the search box is optional); one with a
 * malformed SearchAction is an error. A page with no WebSite node reports
 * nothing. Source: Google Sitelinks search box.
 */
export default defineHint({
  id: 'richresults-website-searchaction',
  name: 'WebSite SearchAction is valid',
  description:
    'Validates WebSite SearchAction JSON-LD (target and query-input) for the sitelinks search box.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: DOCS.searchaction,
  setup(context) {
    onPage(context, (page) =>
      reportRichResults(page, websiteSearchActionFindings),
    );
  },
});
