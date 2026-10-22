import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { altCoverage } from '../../lib/technical/read.js';
import { imageAltCoverageFindings } from '../../lib/technical/checks.js';

/**
 * Reports <img> elements without an alt attribute. alt="" is accepted (decorative). Coverage of 80% or more is a warning, less is an error. Source: LLMScout "image-alt".
 */
export default defineHint({
  id: 'technical-image-alt-coverage',
  name: 'Images have alt text',
  description:
    'Checks that img elements carry an alt attribute (warns from 80% coverage, errors below).',
  category: Category.development,
  groups: ['llmscout', 'seo'],
  reference: 'https://github.com/RudrenduPaul/LLMScout',
  setup(context) {
    onPage(context, (page) => {
      const coverage = altCoverage(page.document);
      for (const { message, severity } of imageAltCoverageFindings(coverage)) {
        page.report(message, {
          severity: severity === 'error' ? Severity.error : Severity.warning,
          // The first image without an alt attribute.
          element: page.document.querySelector('img:not([alt])'),
        });
      }
    });
  },
});
