import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  keywordsInTitleFindings,
  ROCTIFY_REF,
  topKeywords,
  visibleText,
} from '../../lib/seo/content.js';
import { getTitle } from '../../lib/seo/read.js';
import { reportFindings } from './report-findings.js';

/**
 * Warns when none of the three most frequent keywords of the page is in its
 * title. Source: Roctify SEO checker "Keywords in title". A page without a
 * title or without repeated keywords is skipped; other hints cover those.
 */
export default defineHint({
  id: 'seo-keywords-in-title',
  name: 'Title contains the main keywords',
  description:
    'Warns when none of the most frequent keywords of the page is in the title.',
  category: Category.development,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      const keywords = topKeywords(visibleText(page.content));
      reportFindings(
        page,
        keywordsInTitleFindings(getTitle(page.document), keywords),
        { element: page.document.querySelector('title') },
      );
    });
  },
});
