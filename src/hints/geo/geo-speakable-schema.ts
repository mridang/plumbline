import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { containsSpeakable, readJsonLd } from '../../lib/geo/json-ld.js';

const REF = 'https://github.com/RudrenduPaul/LLMScout';

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
      const { parsed } = readJsonLd(page.document);
      if (!parsed.some(containsSpeakable)) {
        page.report(
          `No Speakable structured data found. If this page has content suited for voice assistants, add a "speakable" SpeakableSpecification to its JSON-LD so voice search can surface it. Read more: ${REF}`,
          { severity: Severity.warning },
        );
      }
    });
  },
});
