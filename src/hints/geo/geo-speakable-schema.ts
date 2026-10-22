import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { readJsonLd } from '../../lib/geo/json-ld.js';
import { speakableSchemaFindings, REF } from '../../lib/geo/checks.js';

/**
 * Reports pages with no `SpeakableSpecification` node and no `speakable`
 * property in their JSON-LD. Speakable markup tells voice assistants which
 * content to read aloud. Source: LLMScout `speakable-schema` (warn). It only
 * suits some content, so the absence is a warning. Unparsable blocks are
 * ignored here; `geo-structured-data-invalid` reports them.
 */
export default defineHint({
  id: 'geo-speakable-schema',
  name: 'Page has Speakable structured data',
  description: 'Reports pages without Speakable JSON-LD.',
  category: Category.development,
  groups: ['llmscout', 'agent', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const blocks = readJsonLd(page.document);
      for (const { message, severity } of speakableSchemaFindings(blocks)) {
        page.report(message, {
          severity: severity === 'error' ? Severity.error : Severity.warning,
          element: page.document.querySelector('head'),
          codeSnippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "speakable": {
    "@type": "SpeakableSpecification",
    "cssSelector": ["h1", ".summary"]
  }
}
</script>`,
          codeLanguage: 'html',
        });
      }
    });
  },
});
