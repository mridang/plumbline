import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { headerSnippet } from '../../core/http.js';
import { findRobotsSource } from '../../lib/seo/read.js';

const REF = 'https://www.opengraph.to/articles/robots-nofollow';

/**
 * Reports when the robots meta tag contains nofollow.
 *
 * Page level nofollow stops every link on the page passing value. Source: opengraph.to "Page Has nofollow Directive" (info).
 */

export default defineHint({
  id: 'seo-robots-nofollow',
  name: 'Page is not nofollow',
  description: 'Reports when the robots meta tag contains nofollow.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const source = findRobotsSource(page.document, page.headers, 'nofollow');
      if (source) {
        page.report(
          `The robots meta tag contains "nofollow", so links on this page will not pass SEO value. Remove it if that is unintended. Read more: ${REF}`,
          'element' in source
            ? { severity: Severity.hint, element: source.element }
            : {
                severity: Severity.hint,
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
