import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { headerSnippet } from '../../core/http.js';
import { findRobotsSource } from '../../lib/seo/read.js';
import { robotsNoindex, SEO_ROBOTS_NOINDEX_REF } from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_ROBOTS_NOINDEX_REF;

/**
 * Warns when the robots meta tag contains noindex.
 *
 * Noindex keeps the page out of search results, often by mistake after staging. Source: opengraph.to "Page Is Set to noindex" (warning).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint re-derives the source (meta element or `X-Robots-Tag` header) only to
 * point the finding at the right element or header snippet.
 */

export default defineHint({
  id: 'seo-robots-noindex',
  name: 'Page is not noindex',
  description: 'Warns when the robots meta tag contains noindex.',
  category: Category.development,
  groups: ['opengraph', 'seo', 'roctify'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const [found] = robotsNoindex(page.document, page.headers);
      if (!found) {
        return;
      }
      // Re-derive where the directive was found to point the report at it.
      const source = findRobotsSource(page.document, page.headers, 'noindex');
      page.report(
        found.message,
        source && 'element' in source
          ? { severity: toSeverity(found.severity), element: source.element }
          : {
              severity: toSeverity(found.severity),
              codeSnippet: source
                ? headerSnippet(source.header.name, source.header.value)
                : '',
              codeLanguage: 'http',
            },
      );
    });
  },
});
