import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { recipeFindings, DOCS } from '../../lib/richresults/checks.js';
import { reportRichResults } from './report.js';

/**
 * Validates every schema.org `Recipe` node in the page's JSON-LD against
 * Google's rich-results requirements: `name` and `image` are required (a
 * missing one is an error), and `recipeIngredient` and `recipeInstructions` are
 * recommended (a missing one is a warning). A page with no Recipe node reports
 * nothing. Source: Google Recipe rich results.
 */
export default defineHint({
  id: 'richresults-recipe',
  name: 'Recipe structured data is valid',
  description:
    'Validates Recipe JSON-LD against Google rich-results required and recommended properties.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: DOCS.recipe,
  setup(context) {
    onPage(context, (page) => reportRichResults(page, recipeFindings));
  },
});
