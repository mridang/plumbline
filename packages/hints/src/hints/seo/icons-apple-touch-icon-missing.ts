import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { ROCTIFY_REF } from '../../lib/seo/content.js';
import { appleTouchIconFindings } from '../../lib/seo/mobile.js';
import { reportFindings } from './report-findings.js';

/**
 * Warns when no <link rel="apple-touch-icon"> is declared. Source: Roctify
 * SEO checker "Apple touch icon". iOS uses it for home screen tiles.
 */
export default defineHint({
  id: 'icons-apple-touch-icon-missing',
  name: 'Apple touch icon is set',
  description: 'Warns when the page declares no apple-touch-icon link.',
  category: Category.development,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      const count = page.document.querySelectorAll(
        'link[rel~="apple-touch-icon" i], link[rel~="apple-touch-icon-precomposed" i]',
      ).length;
      reportFindings(page, appleTouchIconFindings(count), {
        element: page.document.querySelector('head'),
        codeSnippet:
          '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        codeLanguage: 'html',
      });
    });
  },
});
