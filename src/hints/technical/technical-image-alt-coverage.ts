import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { altCoverage } from '../../lib/technical/read.js';

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
      if (coverage) {
        page.report(
          `${coverage.missing} of ${coverage.total} <img> tags are missing an alt attribute (${coverage.percent}% coverage). Add descriptive alt text, or alt="" for purely decorative images.`,
          { severity: coverage.failing ? Severity.error : Severity.warning },
        );
      }
    });
  },
});
