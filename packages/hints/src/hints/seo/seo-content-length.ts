import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  contentLengthFindings,
  ROCTIFY_REF,
  visibleText,
  wordsOf,
} from '../../lib/seo/content.js';
import { reportFindings } from './report-findings.js';

/**
 * Warns when the page has fewer than 300 words of text. Source: Roctify SEO
 * checker "Content length". Thin pages rarely rank; the limit is ours because
 * Roctify does not publish its own. The text is read from the HTML as sent,
 * without running scripts, the way a crawler first sees it.
 */
export default defineHint({
  id: 'seo-content-length',
  name: 'Page has enough text',
  description: 'Warns when the page has fewer than 300 words of text.',
  category: Category.development,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      const words = wordsOf(visibleText(page.content)).length;
      reportFindings(page, contentLengthFindings(words), {
        element: page.document.querySelector('body'),
      });
    });
  },
});
