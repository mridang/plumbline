import type { HTMLElement } from '@hint/utils-dom';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage, onSite } from '../../core/page.js';
import type { DocumentLike } from '../../lib/seo/read.js';
import {
  faviconMissing,
  ICONS_FAVICON_MISSING_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = ICONS_FAVICON_MISSING_REF;

/**
 * Reports sites that declare no favicon and serve no /favicon.ico.
 *
 * Without a favicon browsers show a default icon. Source: opengraph.to "Missing Favicon" (info). A /favicon.ico file counts, because browsers request it by default.
 *
 * The predicate (no declared icon), message and severity live in
 * `src/lib/seo/checks.ts` and are shared with the Lighthouse check. Only this
 * hint can also fetch `/favicon.ico`, so the finding is reported only when the
 * DOM declares none *and* that fallback request fails.
 */

export default defineHint({
  id: 'icons-favicon-missing',
  name: 'Site has a favicon',
  description:
    'Reports sites that declare no favicon and serve no /favicon.ico.',
  category: Category.development,
  groups: ['opengraph', 'seo', 'roctify'],
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
    // Browsers request /favicon.ico on their own, so a served file counts.
    onSite(context, async (site) => {
      const [found] = document ? faviconMissing(document) : [];
      if (!found) {
        return;
      }
      const response = await site.fetch('/favicon.ico');
      if (response?.response.statusCode === 200) {
        return;
      }
      site.report(site.url.href, found.message, {
        severity: toSeverity(found.severity),
        element: head,
        codeSnippet: '<link rel="icon" href="/favicon.ico">',
        codeLanguage: 'html',
      });
    });
  },
});
