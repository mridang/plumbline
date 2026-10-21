import { Severity } from '@hint/utils-types';
import type { ReportOptions } from 'hint';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { robotsAdvanced } from '../../lib/technical/read.js';

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
      const { content, present, missing } = robotsAdvanced(page.document);
      const meta = page.document.querySelector('meta[name="robots" i]');
      const warn = (message: string, options: Partial<ReportOptions> = {}) =>
        page.report(message, { severity: Severity.warning, ...options });
      if (content === '') {
        warn(
          'No meta robots directives found; default Google Search snippet and preview limits will apply. Add <meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1">.',
          // An empty tag is the element at fault; with none, the head is.
          meta
            ? { element: meta }
            : {
                element: page.document.querySelector('head'),
                codeSnippet:
                  '<meta name="robots" content="max-snippet:-1, max-image-preview:large, max-video-preview:-1">',
                codeLanguage: 'html',
              },
        );
      } else if (content.split(',').some((t) => t.trim() === 'noindex')) {
        // The page is excluded from search anyway; snippets are moot.
      } else if (present.length === 0) {
        warn(
          `Meta robots tag found ("${content}") but no advanced snippet/preview directives (${missing.join(', ')}).`,
          { element: meta },
        );
      } else if (missing.length > 0) {
        warn(
          `Meta robots tag has ${present.join(', ')}, but is missing: ${missing.join(', ')}.`,
          { element: meta },
        );
      }
    });
  },
});
