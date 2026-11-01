import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { friendlyUrlFindings, ROCTIFY_REF } from '../../lib/seo/content.js';
import { reportFindings } from './report-findings.js';

/**
 * Warns when the page URL is long, has upper-case letters, underscores,
 * encoded characters, many levels or many query parameters. Source: Roctify
 * SEO checker "SEO friendly URL"; the limits are ours.
 */
export default defineHint({
  id: 'seo-url-friendly',
  name: 'URL is SEO friendly',
  description:
    'Warns when the URL is long, upper case, has underscores, encoded characters, many levels or many parameters.',
  category: Category.development,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      reportFindings(page, friendlyUrlFindings(page.url), {
        codeSnippet: page.url,
      });
    });
  },
});
