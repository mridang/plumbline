import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  frequentKeywordsFindings,
  ROCTIFY_REF,
  topKeywords,
  visibleText,
} from '../../lib/seo/content.js';
import { reportFindings } from './report-findings.js';

/**
 * Lists the five most frequent keywords of the page as information. Source:
 * Roctify SEO checker "Most frequent keywords". Stop words, short words and
 * numbers are ignored, and a word must appear at least twice.
 */
export default defineHint({
  id: 'seo-keywords-frequent',
  name: 'Most frequent keywords',
  description: 'Lists the most frequent keywords of the page text.',
  category: Category.development,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      reportFindings(
        page,
        frequentKeywordsFindings(topKeywords(visibleText(page.content))),
      );
    });
  },
});
