import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { themeColorMeta, THEME_COLOR_META_REF } from '../../lib/pwa/checks.js';
import { toSeverity } from './to-severity.js';

const REF = THEME_COLOR_META_REF;

/**
 * Recommends a `<meta name="theme-color">` on the page.
 *
 * The theme-color meta themes the browser toolbar and address bar as soon as
 * the page loads, before the manifest is fetched, so it complements the
 * manifest's `theme_color`. Source: W3C Web App Manifest / web.dev install
 * theming (informational).
 *
 * Stock webhint ships `@hint/hint-apple-touch-icons` for the apple-touch-icon
 * link, so that sibling signal is left to stock webhint and only this
 * theme-color meta is added here. The predicate, message and severity live in
 * `src/lib/pwa/checks.ts` and are shared with the Lighthouse check.
 */

export default defineHint({
  id: 'theme-color-meta',
  name: 'Page has a theme-color meta tag',
  description: 'Recommends a <meta name="theme-color"> on the page.',
  category: Category.development,
  groups: ['w3c', 'pwa'],
  reference: REF,
  setup(context) {
    onPage(context, (page) => {
      const [found] = themeColorMeta(page.document);
      if (found) {
        page.report(found.message, {
          severity: toSeverity(found.severity),
          element: page.document.querySelector('head'),
          codeSnippet: '<meta name="theme-color" content="#ffffff">',
          codeLanguage: 'html',
        });
      }
    });
  },
});
