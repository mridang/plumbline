import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { productFindings, DOCS } from '../../lib/richresults/checks.js';
import { reportRichResults } from './report.js';

/**
 * Validates every schema.org `Product` node in the page's JSON-LD against
 * Google's rich-results requirements: `name` is required, `image` is
 * recommended, and when an `offers`, `review` or `aggregateRating` is present
 * it must itself be well-formed (an Offer needs `price` and `priceCurrency`; an
 * AggregateOffer needs `lowPrice` and `priceCurrency`; a rating needs a
 * `ratingValue`). A product with none of the three is warned to add one. A page
 * with no Product node reports nothing. Source: Google Product rich results.
 */
export default defineHint({
  id: 'richresults-product',
  name: 'Product structured data is valid',
  description:
    'Validates Product JSON-LD (name, image, offers, review, aggregateRating) against Google rich-results rules.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: DOCS.product,
  setup(context) {
    onPage(context, (page) => reportRichResults(page, productFindings));
  },
});
