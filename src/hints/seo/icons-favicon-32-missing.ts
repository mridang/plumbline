import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage, onSite } from '../../core/page.js';
import {
  getIconLinks,
  isPng32Icon,
  type IconLink,
} from '../../lib/seo/icons.js';

const REF = 'https://www.opengraph.to/articles/missing-favicon-32';

/**
 * Reports sites without a 32x32 PNG favicon link.
 *
 * A dedicated 32x32 PNG gives crisp tab icons; a plain .ico does not satisfy it. Source: opengraph.to "Missing 32x32 Favicon" (info).
 */

export default defineHint({
  id: 'icons-favicon-32-missing',
  name: 'Site has a 32x32 png favicon',
  description: 'Reports sites without a 32x32 PNG favicon link.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    // The icons declared in the page, read once the DOM is parsed.
    let icons: IconLink[] = [];
    onPage(context, (page) => {
      icons = getIconLinks(page.document);
    });
    onSite(context, (site) => {
      if (icons.some(isPng32Icon)) {
        return;
      }
      site.report(
        site.url.href,
        `No 32x32 PNG favicon found. Add <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">. Read more: ${REF}`,
        { severity: Severity.hint },
      );
    });
  },
});
