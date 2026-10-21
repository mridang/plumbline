import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import {
  getRobotsDirectives,
  getRobotsHeaderDirectives,
} from '../../lib/seo/read.js';

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
      if (
        [
          ...getRobotsDirectives(page.document),
          ...getRobotsHeaderDirectives(page.headers),
        ].includes('noindex')
      ) {
        page.report(
          `The robots meta tag contains "noindex", so search engines will not index this page. Remove it if that is unintended. Read more: ${REF}`,
          { severity: Severity.warning },
        );
      }
    });
  },
});
