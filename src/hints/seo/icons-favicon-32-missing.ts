import type { HTMLElement } from '@hint/utils-dom';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage, onSite } from '../../core/page.js';
import type { DocumentLike } from '../../lib/seo/read.js';
import {
  favicon32Missing,
  ICONS_FAVICON_32_MISSING_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = ICONS_FAVICON_32_MISSING_REF;

/**
 * Reports sites without a 32x32 PNG favicon link.
 *
 * A dedicated 32x32 PNG gives crisp tab icons; a plain .ico does not satisfy it. Source: opengraph.to "Missing 32x32 Favicon" (info).
 *
 * The predicate, message and severity live in `src/lib/seo/checks.ts` and are
 * shared with the Lighthouse check; this hint only adds the `<head>` element
 * and the snippet to add.
 */

export default defineHint({
  id: 'icons-favicon-32-missing',
  name: 'Site has a 32x32 png favicon',
  description: 'Reports sites without a 32x32 PNG favicon link.',
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
      const [found] = document ? favicon32Missing(document) : [];
      if (!found) {
        return;
      }
      site.report(site.url.href, found.message, {
        severity: toSeverity(found.severity),
        element: head,
        codeSnippet:
          '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
        codeLanguage: 'html',
      });
    });
  },
});
