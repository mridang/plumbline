import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { containsType, readJsonLd } from '../../lib/geo/json-ld.js';

const REF = 'https://github.com/RudrenduPaul/LLMScout';

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
      const { parsed } = readJsonLd(page.document);
      if (!parsed.some((data) => containsType(data, 'FAQPage'))) {
        page.report(
          `No FAQPage structured data found. If this page has an FAQ section, mark it up with FAQPage JSON-LD so generative engines can surface individual answers. Read more: ${REF}`,
          {
            severity: Severity.warning,
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
          },
        );
      }
    });
  },
});
