import { Severity } from '@hint/utils-types';
import type { ReportOptions } from 'hint';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { robotsAdvanced } from '../../lib/technical/read.js';
import { robotsMetaAdvancedFindings } from '../../lib/technical/checks.js';

/**
 * Warns when the robots meta tag is missing or lacks the advanced snippet and preview directives. A noindex page is skipped (seo-robots-noindex covers it). Source: LLMScout "robots-meta-directives" (warn).
 */
export default defineHint({
  id: 'technical-robots-meta-advanced',
  name: 'Advanced robots meta directives',
  description:
    'Warns when the robots meta tag lacks max-snippet, max-image-preview or max-video-preview.',
  category: Category.development,
  groups: ['llmscout', 'seo'],
  reference: 'https://github.com/RudrenduPaul/LLMScout',
  setup(context) {
    onPage(context, (page) => {
      // The shared check decides whether (and what) to report; the hint only
      // picks the element each finding points at. `robotsAdvanced` is computed
      // once and reused for both the finding and that element decision.
      const robots = robotsAdvanced(page.document);
      const meta = page.document.querySelector('meta[name="robots" i]');
      // When the tag is absent there is no element to blame, so the finding
      // points at the head with an example tag to add; otherwise it points at
      // the robots meta tag itself.
      const elementOptions: Partial<ReportOptions> =
        robots.content === '' && !meta
          ? {
              element: page.document.querySelector('head'),
              codeSnippet:
                '<meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1">',
              codeLanguage: 'html',
            }
          : { element: meta };
      for (const { message, severity } of robotsMetaAdvancedFindings(robots)) {
        page.report(message, {
          severity: severity === 'error' ? Severity.error : Severity.warning,
          ...elementOptions,
        });
      }
    });
  },
});
