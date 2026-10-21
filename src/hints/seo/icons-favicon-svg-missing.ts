import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage, onSite } from '../../core/page.js';
import { getIconLinks, isSvgIcon, type IconLink } from '../../lib/seo/icons.js';

const REF = 'https://www.opengraph.to/articles/missing-svg-favicon';

/**
 * Reports sites without an SVG favicon link.
 *
 * SVG favicons scale perfectly and support dark mode. Source: opengraph.to "No SVG Favicon Found" (info).
 */

export default defineHint({
  id: 'icons-favicon-svg-missing',
  name: 'Site has an svg favicon',
  description: 'Reports sites without an SVG favicon link.',
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
      if (icons.some(isSvgIcon)) {
        return;
      }
      site.report(
        site.url.href,
        `No SVG favicon found. Add <link rel="icon" type="image/svg+xml" href="/favicon.svg">. Read more: ${REF}`,
        { severity: Severity.hint },
      );
    });
  },
});
