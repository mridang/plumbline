import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { articleFindings, DOCS } from '../../lib/richresults/checks.js';
import { reportRichResults } from './report.js';

/**
 * Validates every `Article`, `NewsArticle` or `BlogPosting` node in the page's
 * JSON-LD against Google's Article rich-results guidance. Google documents no
 * strictly required property for Article, but strongly recommends `headline`,
 * `image`, `datePublished` and `author`, so a missing one is a warning, never
 * an error. A page with no such node reports nothing. Source: Google Article
 * rich results.
 */
export default defineHint({
  id: 'richresults-article',
  name: 'Article structured data is valid',
  description:
    'Validates Article/NewsArticle/BlogPosting JSON-LD against Google rich-results recommended properties.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: DOCS.article,
  setup(context) {
    onPage(context, (page) => reportRichResults(page, articleFindings));
  },
});
