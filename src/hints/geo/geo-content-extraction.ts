import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  measureContent,
  UNSTRUCTURED_BLOCK_THRESHOLD,
} from '../../lib/geo/content.js';

const REF = 'https://github.com/RudrenduPaul/LLMScout';

/**
 * A heuristic for how well a generative engine can chunk the page. Reports a
 * warning when `<main>` (or the body) has no headings and no paragraph or list
 * item longer than 30 characters, or when a `<div>` holds more than 800
 * characters of text with no heading, paragraph or list item inside. Source:
 * LLMScout `content-extraction` (warn). Only the served HTML is read, so a page
 * that renders its content with JavaScript can be flagged wrongly.
 */
export default defineHint({
  id: 'geo-content-extraction',
  name: 'Page content is easy to extract',
  description:
    'Reports pages whose content lacks heading and paragraph structure.',
  category: Category.development,
  groups: ['llmscout', 'agent', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const stats = measureContent(page.document);
      if (!stats) {
        return;
      }
      if (stats.headingCount === 0 && stats.paragraphCount === 0) {
        page.report(
          `No headings or paragraph-level structure detected; a generative engine may struggle to extract distinct sections from this page. Break content into headings (<h2>, <h3>, ...) and paragraphs (<p>) rather than unstructured text. Read more: ${REF}`,
          { severity: Severity.warning },
        );
      } else if (stats.maxUnstructuredLength > UNSTRUCTURED_BLOCK_THRESHOLD) {
        page.report(
          `Found a ${stats.maxUnstructuredLength}-character block of text with no internal heading or paragraph structure. Break large unstructured blocks into headed sections and paragraphs. Read more: ${REF}`,
          { severity: Severity.warning },
        );
      }
    });
  },
});
