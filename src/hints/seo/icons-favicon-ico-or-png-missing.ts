import { Severity } from '@hint/utils-types';
import type { HTMLElement } from '@hint/utils-dom';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage, onSite } from '../../core/page.js';
import {
  getIconLinks,
  isIcoIcon,
  isPngIcon,
  type IconLink,
} from '../../lib/seo/icons.js';

const REF = 'https://www.opengraph.to/articles/favicon-icon-missing';

/**
 * Warns when there is no .ico or .png favicon (Google Search does not support SVG favicons).
 *
 * Google Search needs an ICO, PNG or GIF favicon. Source: opengraph.to "Missing .ico or .png Favicon" (warning). Counts icon links to .ico/.png and a served /favicon.ico.
 */

export default defineHint({
  id: 'icons-favicon-ico-or-png-missing',
  name: 'Site has an ico or png favicon',
  description:
    'Warns when there is no .ico or .png favicon (Google Search does not support SVG favicons).',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    // The icons declared in the page, read once the DOM is parsed.
    let icons: IconLink[] = [];
    // The <head> the missing icon link belongs in.
    let head: HTMLElement | null = null;
    onPage(context, (page) => {
      icons = getIconLinks(page.document);
      head = page.document.querySelector('head');
    });
    // Browsers request /favicon.ico on their own, so a served file counts.
    onSite(context, async (site) => {
      if (icons.some((i) => isIcoIcon(i) || isPngIcon(i))) {
        return;
      }
      const response = await site.fetch('/favicon.ico');
      if (response?.response.statusCode === 200) {
        return;
      }
      site.report(
        site.url.href,
        `No .ico or .png favicon found; Google Search does not display SVG favicons. Add <link rel="icon" href="/favicon.ico" sizes="any"> or a PNG icon. Read more: ${REF}`,
        {
          severity: Severity.warning,
          element: head,
          codeSnippet: '<link rel="icon" href="/favicon.ico" sizes="any">',
          codeLanguage: 'html',
        },
      );
    });
  },
});
