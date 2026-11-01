import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  structuredDataMissing,
  SEO_STRUCTURED_DATA_MISSING_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_STRUCTURED_DATA_MISSING_REF;

/**
 * Reports pages without a JSON-LD block.
 *
 * Structured data helps search engines understand content. Source: opengraph.to "No Structured Data (JSON-LD) Found" (info).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint only adds the `<head>` element and a page-specific snippet to add.
 */

export default defineHint({
  id: 'seo-structured-data-missing',
  name: 'Page has JSON-LD structured data',
  description: 'Reports pages without a JSON-LD block.',
  category: Category.development,
  groups: ['opengraph', 'seo', 'roctify'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const [found] = structuredDataMissing(page.document);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.querySelector('head'),
          codeSnippet: `<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Page title",
  "url": "${page.url}"
}
</script>`,
          codeLanguage: 'html',
        });
      }
    });
  },
});
