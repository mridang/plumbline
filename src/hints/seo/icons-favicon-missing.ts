import { Severity } from '@hint/utils-types';
import type { HTMLElement } from '@hint/utils-dom';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage, onSite } from '../../core/page.js';
import { getIconLinks, type IconLink } from '../../lib/seo/icons.js';

const REF = 'https://www.opengraph.to/articles/missing-favicon';

/**
 * Reports sites that declare no favicon and serve no /favicon.ico.
 *
 * Without a favicon browsers show a default icon. Source: opengraph.to "Missing Favicon" (info). A /favicon.ico file counts, because browsers request it by default.
 */

export default defineHint({
  id: 'icons-favicon-missing',
  name: 'Site has a favicon',
  description:
    'Reports sites that declare no favicon and serve no /favicon.ico.',
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
      if (icons.length > 0) {
        return;
      }
      const response = await site.fetch('/favicon.ico');
      if (response?.response.statusCode === 200) {
        return;
      }
      site.report(
        site.url.href,
        `No favicon found. Add <link rel="icon" href="/favicon.ico"> to the <head> or serve /favicon.ico. Read more: ${REF}`,
        {
          severity: Severity.hint,
          element: head,
          codeSnippet: '<link rel="icon" href="/favicon.ico">',
          codeLanguage: 'html',
        },
      );
    });
  },
});
