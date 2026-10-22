import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { reviewFindings, DOCS } from '../../lib/richresults/checks.js';
import { reportRichResults } from './report.js';

/**
 * Validates every `Review` and standalone `AggregateRating` node in the page's
 * JSON-LD against Google's review-snippet requirements: a `Review` needs
 * `itemReviewed` and a `reviewRating` carrying a `ratingValue`; an
 * `AggregateRating` needs a `ratingValue` and one of `ratingCount`/
 * `reviewCount`. A page with no such node reports nothing. Source: Google
 * Review snippet rich results.
 */
export default defineHint({
  id: 'richresults-review',
  name: 'Review structured data is valid',
  description:
    'Validates Review/AggregateRating JSON-LD (itemReviewed, reviewRating with ratingValue) against Google rich-results rules.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: DOCS.review,
  setup(context) {
    onPage(context, (page) => reportRichResults(page, reviewFindings));
  },
});
