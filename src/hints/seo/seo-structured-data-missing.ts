import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { hasJsonLd } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/missing-structured-data';

/**
 * Reports pages without a JSON-LD block.
 *
 * Structured data helps search engines understand content. Source: opengraph.to "No Structured Data (JSON-LD) Found" (info).
 */

export default defineHint({
  id: 'seo-structured-data-missing',
  name: 'Page has JSON-LD structured data',
  description: 'Reports pages without a JSON-LD block.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      if (!hasJsonLd(page.document)) {
        page.report(
          `No JSON-LD structured data found. Add a <script type="application/ld+json"> block, for example WebPage or Article. Read more: ${REF}`,
          { severity: Severity.hint },
        );
      }
    });
  },
});
