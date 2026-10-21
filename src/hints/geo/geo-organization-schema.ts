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
      const { parsed } = readJsonLd(page.document);
      // The first entity node found, across all blocks, is the one judged.
      let entity: Record<string, unknown> | null = null;
      for (const data of parsed) {
        entity = findEntityNode(data);
        if (entity) {
          break;
        }
      }
      if (!entity) {
        page.report(
          `No ${ENTITY_TYPE_LABEL} structured data found. Add Organization (or Person) JSON-LD with a sameAs array of your official social/profile URLs to strengthen Knowledge Panel signals. Read more: ${REF}`,
          { severity: Severity.warning },
        );
      } else if (!hasNonEmptySameAs(entity)) {
        page.report(
          `The ${ENTITY_TYPE_LABEL} structured data has no sameAs property. Add a sameAs array of your official social/profile URLs. Read more: ${REF}`,
          { severity: Severity.warning },
        );
      }
    });
  },
});
