import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { measureContent } from '../../lib/geo/content.js';
import { contentExtractionFindings, REF } from '../../lib/geo/checks.js';

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
      const root =
        page.document.querySelector('main') ??
        page.document.querySelector('body');
      // The shared check decides the message; the hint points the report at the
      // root for the "no structure" finding, or at the oversized `<div>` for the
      // block finding, which the two `stats` branches tell apart.
      const noStructure =
        stats.headingCount === 0 && stats.paragraphCount === 0;
      for (const { message, severity } of contentExtractionFindings(stats)) {
        page.report(message, {
          severity: severity === 'error' ? Severity.error : Severity.warning,
          element: noStructure
            ? root
            : root?.querySelectorAll('div')[stats.unstructuredIndex],
        });
      }
    });
  },
});
