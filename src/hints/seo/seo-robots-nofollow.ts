import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { headerSnippet } from '../../core/http.js';
import { findRobotsSource } from '../../lib/seo/read.js';
import {
  robotsNofollow,
  SEO_ROBOTS_NOFOLLOW_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = SEO_ROBOTS_NOFOLLOW_REF;

/**
 * Reports when the robots meta tag contains nofollow.
 *
 * Page level nofollow stops every link on the page passing value. Source: opengraph.to "Page Has nofollow Directive" (info).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts`; this
 * hint re-derives the source (meta element or `X-Robots-Tag` header) only to
 * point the finding at the right element or header snippet.
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
      const [found] = robotsNofollow(page.document, page.headers);
      if (!found) {
        return;
      }
      // Re-derive where the directive was found to point the report at it.
      const source = findRobotsSource(page.document, page.headers, 'nofollow');
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
