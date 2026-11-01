import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  anchorFindings,
  anchorProblem,
  ROCTIFY_REF,
  type AnchorProblem,
} from '../../lib/seo/content.js';
import { reportFindings } from './report-findings.js';

/**
 * Warns about links with no text and links with generic text such as "click
 * here". Source: Roctify SEO checker "Link anchor text". Search engines use
 * the anchor text to learn what the target page is about.
 */
export default defineHint({
  id: 'seo-link-anchor-text',
  name: 'Links have descriptive text',
  description: 'Warns about links with no text or with generic text.',
  category: Category.development,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      const anchors = [...page.document.querySelectorAll('a[href]')];
      const found: {
        element: (typeof anchors)[number];
        problem: AnchorProblem;
      }[] = [];
      for (const element of anchors) {
        const problem = anchorProblem({
          text: element.textContent ?? '',
          label: element.getAttribute('aria-label') ?? '',
          imageAlt: element.querySelector('img')?.getAttribute('alt') ?? '',
          title: element.getAttribute('title') ?? '',
        });
        if (problem) {
          found.push({ element, problem });
        }
      }
      reportFindings(page, anchorFindings(found.map((f) => f.problem)), {
        element: found[0]?.element ?? null,
      });
    });
  },
});
