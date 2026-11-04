import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { ROCTIFY_REF } from '../../lib/seo/content.js';
import { viewportFindings } from '../../lib/seo/mobile.js';
import { reportFindings } from './report-findings.js';

/**
 * Requires <meta name="viewport" content="width=device-width, ..."> and warns
 * when it blocks zooming. Source: Roctify SEO checker "Mobile viewport".
 * Google indexes the mobile version of a page first.
 */
export default defineHint({
  id: 'seo-viewport',
  name: 'Mobile viewport is set',
  description:
    'Requires a viewport meta tag with width=device-width that allows zooming.',
  category: Category.development,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      const tag = page.document.querySelector('meta[name="viewport" i]');
      reportFindings(
        page,
        viewportFindings(tag ? (tag.getAttribute('content') ?? '') : null),
        {
          element: tag ?? page.document.querySelector('head'),
          codeSnippet:
            '<meta name="viewport" content="width=device-width, initial-scale=1">',
          codeLanguage: 'html',
        },
      );
    });
  },
});
