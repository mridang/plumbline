import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  DEPRECATED_TAGS,
  deprecatedTagFindings,
  ROCTIFY_REF,
} from '../../lib/seo/content.js';
import { reportFindings } from './report-findings.js';

/**
 * Warns when the page uses HTML elements the standard has made obsolete, such
 * as <font>, <center> and <marquee>. Source: Roctify SEO checker "Deprecated
 * HTML tags"; the element list is the HTML standard's obsolete elements.
 */
export default defineHint({
  id: 'seo-deprecated-html',
  name: 'No obsolete HTML elements',
  description: 'Warns when the page uses obsolete HTML elements.',
  category: Category.development,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      const counts: Record<string, number> = {};
      for (const tag of DEPRECATED_TAGS) {
        counts[tag] = page.document.querySelectorAll(tag).length;
      }
      reportFindings(page, deprecatedTagFindings(counts), {
        element: page.document.querySelector(DEPRECATED_TAGS.join(',')),
      });
    });
  },
});
