import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  ENTITY_TYPE_LABEL,
  findEntityNode,
  hasNonEmptySameAs,
  readJsonLd,
} from '../../lib/geo/json-ld.js';

const REF = 'https://github.com/RudrenduPaul/LLMScout';

/**
 * Reports pages whose JSON-LD has no Organization, Corporation, LocalBusiness
 * or Person node, or whose first such node has an empty or missing `sameAs`.
 * Linking official profiles strengthens Knowledge Panel signals. Source:
 * LLMScout `organization-schema` (warn). Unparsable blocks are ignored here;
 * `geo-structured-data-invalid` reports them.
 */
export default defineHint({
  id: 'geo-organization-schema',
  name: 'Page has Organization schema with sameAs',
  description:
    'Reports pages without Organization or Person JSON-LD that links profiles with sameAs.',
  category: Category.development,
  groups: ['llmscout', 'agent', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const { parsed, parsedAt } = readJsonLd(page.document);
      // The first entity node found, across all blocks, is the one judged.
      let entity: Record<string, unknown> | null = null;
      let block = -1;
      for (const [index, data] of parsed.entries()) {
        entity = findEntityNode(data);
        if (entity) {
          block = parsedAt[index];
          break;
        }
      }
      if (!entity) {
        page.report(
          `No ${ENTITY_TYPE_LABEL} structured data found. Add Organization (or Person) JSON-LD with a sameAs array of your official social/profile URLs to strengthen Knowledge Panel signals. Read more: ${REF}`,
          {
            severity: Severity.warning,
            element: page.document.querySelector('head'),
            codeSnippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Your organization",
  "url": "https://example.com",
  "sameAs": [
    "https://www.linkedin.com/company/your-organization",
    "https://x.com/your-organization"
  ]
}
</script>`,
            codeLanguage: 'html',
          },
        );
      } else if (!hasNonEmptySameAs(entity)) {
        page.report(
          `The ${ENTITY_TYPE_LABEL} structured data has no sameAs property. Add a sameAs array of your official social/profile URLs. Read more: ${REF}`,
          {
            severity: Severity.warning,
            // The block that holds the entity lacking sameAs.
            element: page.document.querySelectorAll(
              'script[type="application/ld+json" i]',
            )[block],
          },
        );
      }
    });
  },
});
