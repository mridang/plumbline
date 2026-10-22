import type { HTMLElement } from '@hint/utils-dom';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage, onSite } from '../../core/page.js';
import type { DocumentLike } from '../../lib/seo/read.js';
import {
  faviconSvgMissing,
  ICONS_FAVICON_SVG_MISSING_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = ICONS_FAVICON_SVG_MISSING_REF;

/**
 * Reports sites without an SVG favicon link.
 *
 * SVG favicons scale perfectly and support dark mode. Source: opengraph.to "No SVG Favicon Found" (info).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts` and are
 * shared with the Lighthouse check; this hint only adds the `<head>` element
 * and the snippet to add.
 */

export default defineHint({
  id: 'icons-favicon-svg-missing',
  name: 'Site has an svg favicon',
  description: 'Reports sites without an SVG favicon link.',
  category: Category.development,
  groups: ['opengraph', 'seo'],
  reference: REF,
  setup(context) {
    // The parsed document and the <head> the missing icon link belongs in,
    // captured once the DOM is available for the later onSite check.
    let document: DocumentLike | null = null;
    let head: HTMLElement | null = null;
    onPage(context, (page) => {
      document = page.document;
      head = page.document.querySelector('head');
    });
    onSite(context, (site) => {
      const [found] = document ? faviconSvgMissing(document) : [];
      if (!found) {
        return;
      }
      site.report(site.url.href, found.message, {
        severity: toSeverity(found.severity),
        element: head,
        codeSnippet:
          '<link rel="icon" type="image/svg+xml" href="/favicon.svg">',
        codeLanguage: 'html',
      });
    });
  },
});
