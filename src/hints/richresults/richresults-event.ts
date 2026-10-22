import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { eventFindings, DOCS } from '../../lib/richresults/checks.js';
import { reportRichResults } from './report.js';

/**
 * Validates every `Event` node in the page's JSON-LD against Google's event
 * rich-results requirements: `name`, `startDate` and `location` are required
 * (a missing one is an error) and `endDate` is recommended. A page with no
 * Event node reports nothing. Source: Google Event rich results.
 */
export default defineHint({
  id: 'richresults-event',
  name: 'Event structured data is valid',
  description:
    'Validates Event JSON-LD (name, startDate, location) against Google rich-results rules.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: DOCS.event,
  setup(context) {
    onPage(context, (page) => reportRichResults(page, eventFindings));
  },
});
