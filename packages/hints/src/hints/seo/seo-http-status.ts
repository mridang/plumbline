import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { httpStatusFindings, ROCTIFY_REF } from '../../lib/seo/content.js';
import { reportFindings } from './report-findings.js';

/**
 * Reports a page that does not answer 200. Source: Roctify SEO checker "HTTP
 * status". An error status keeps the page out of the index.
 */
export default defineHint({
  id: 'seo-http-status',
  name: 'Page answers 200',
  description: 'Reports a page whose HTTP status is not 200.',
  category: Category.development,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      reportFindings(page, httpStatusFindings(page.status), {
        codeSnippet: `HTTP ${page.status}`,
      });
    });
  },
});
