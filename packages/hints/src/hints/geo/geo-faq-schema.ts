import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { readJsonLd } from '../../lib/geo/json-ld.js';
import { faqSchemaFindings, REF } from '../../lib/geo/checks.js';

/**
 * Reports pages with no FAQPage JSON-LD node (also found inside `@graph`, arrays
 * or an array `@type`). FAQ markup lets generative engines surface individual
 * answers. Source: LLMScout `faq-schema` (warn). It only applies to pages with
 * FAQ content, so the absence is a warning, never an error. Unparsable blocks
 * are ignored here; `geo-structured-data-invalid` reports them.
 */
export default defineHint({
  id: 'geo-faq-schema',
  name: 'Page has FAQPage structured data',
  description: 'Reports pages without FAQPage JSON-LD.',
  category: Category.development,
  groups: ['llmscout', 'agent', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const blocks = readJsonLd(page.document);
      for (const { message, severity } of faqSchemaFindings(blocks)) {
        page.report(message, {
          severity: severity === 'error' ? Severity.error : Severity.warning,
          element: page.document.querySelector('head'),
          codeSnippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Your question?",
      "acceptedAnswer": { "@type": "Answer", "text": "Your answer." }
    }
  ]
}
</script>`,
          codeLanguage: 'html',
        });
      }
    });
  },
});
