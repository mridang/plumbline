import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { findEntityNode, readJsonLd } from '../../lib/geo/json-ld.js';
import { organizationSchemaFindings, REF } from '../../lib/geo/checks.js';

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
      const blocks = readJsonLd(page.document);
      const findings = organizationSchemaFindings(blocks);
      if (findings.length === 0) {
        return;
      }
      // The shared check decides the message; the hint re-derives which entity
      // (and which block) it is about to point the report at the right element.
      // The first entity node found, across all blocks, is the one judged.
      let entity: Record<string, unknown> | null = null;
      let block = -1;
      for (const [index, data] of blocks.parsed.entries()) {
        entity = findEntityNode(data);
        if (entity) {
          block = blocks.parsedAt[index];
          break;
        }
      }
      const [{ message, severity }] = findings;
      const reportSeverity =
        severity === 'error' ? Severity.error : Severity.warning;
      if (!entity) {
        page.report(message, {
          severity: reportSeverity,
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
        });
      } else {
        page.report(message, {
          severity: reportSeverity,
          // The block that holds the entity lacking sameAs.
          element: page.document.querySelectorAll(
            'script[type="application/ld+json" i]',
          )[block],
        });
      }
    });
  },
});
