import type { HTMLElement } from '@hint/utils-dom';
import { Category, defineHint } from '../../core/define-hint.js';
import { onPage, onSite } from '../../core/page.js';
import type { DocumentLike } from '../../lib/seo/read.js';
import {
  faviconIcoOrPngMissing,
  ICONS_FAVICON_ICO_OR_PNG_MISSING_REF,
} from '../../lib/seo/checks.js';
import { toSeverity } from './to-severity.js';

const REF = ICONS_FAVICON_ICO_OR_PNG_MISSING_REF;

/**
 * Warns when there is no .ico or .png favicon (Google Search does not support SVG favicons).
 *
 * Google Search needs an ICO, PNG or GIF favicon. Source: opengraph.to "Missing .ico or .png Favicon" (warning). Counts icon links to .ico/.png and a served /favicon.ico.
 *
 * The predicate (no declared .ico/.png icon), message and severity live in
 * `src/lib/seo/checks.ts` and are shared with the Lighthouse check. Only this
 * hint can also fetch `/favicon.ico`, so the finding is reported only when the
 * DOM declares none *and* that fallback request fails.
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
      const [found] = document ? faviconIcoOrPngMissing(document) : [];
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
        codeSnippet: '<link rel="icon" href="/favicon.ico" sizes="any">',
        codeLanguage: 'html',
      });
    });
  },
});
