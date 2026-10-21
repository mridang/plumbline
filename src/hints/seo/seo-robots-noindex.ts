import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { headerSnippet } from '../../core/http.js';
import { findRobotsSource } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/robots-noindex';

/**
 * Warns when the robots meta tag contains noindex.
 *
 * noindex keeps the page out of search results, often by mistake after staging. Source: opengraph.to "Page Is Set to noindex" (warning).
 */

export default defineHint({
  id: 'seo-robots-noindex',
  name: 'Page is not noindex',
  description: 'Warns when the robots meta tag contains noindex.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const source = findRobotsSource(page.document, page.headers, 'noindex');
      if (source) {
        page.report(
          `The robots meta tag contains "noindex", so search engines will not index this page. Remove it if that is unintended. Read more: ${REF}`,
          'element' in source
            ? { severity: Severity.warning, element: source.element }
            : {
                severity: Severity.warning,
                codeSnippet: headerSnippet(
                  source.header.name,
                  source.header.value,
                ),
                codeLanguage: 'http',
              },
        );
      }
    });
  },
});
