import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { videoFindings, DOCS } from '../../lib/richresults/checks.js';
import { reportRichResults } from './report.js';

/**
 * Validates every `VideoObject` node in the page's JSON-LD against Google's
 * video rich-results requirements: `name`, `thumbnailUrl` and `uploadDate` are
 * required (a missing one is an error) and `description` is recommended. A page
 * with no VideoObject node reports nothing. Source: Google Video rich results.
 */
export default defineHint({
  id: 'richresults-video',
  name: 'VideoObject structured data is valid',
  description:
    'Validates VideoObject JSON-LD (name, thumbnailUrl, uploadDate) against Google rich-results rules.',
  category: Category.development,
  groups: ['google', 'seo'],
  reference: DOCS.video,
  setup(context) {
    onPage(context, (page) => reportRichResults(page, videoFindings));
  },
});
