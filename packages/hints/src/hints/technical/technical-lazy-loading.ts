import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { ROCTIFY_REF } from '../../lib/seo/content.js';
import { lazyLoadingFindings } from '../../lib/technical/speed.js';
import { reportFindings } from '../seo/report-findings.js';

/**
 * Warns when images and iframes after the first two do not use
 * loading="lazy". Source: Roctify SEO checker "Lazy loading". The first two
 * are left alone because they are probably visible at load.
 */
export default defineHint({
  id: 'technical-lazy-loading',
  name: 'Images below the fold are lazy loaded',
  description:
    'Warns when images and iframes after the first two have no loading="lazy".',
  category: Category.performance,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      const items = [...page.document.querySelectorAll('img, iframe')];
      reportFindings(
        page,
        lazyLoadingFindings(
          items.map((item) => ({
            lazy: (item.getAttribute('loading') ?? '').toLowerCase() === 'lazy',
          })),
        ),
        {
          element:
            items
              .slice(2)
              .find((item) => item.getAttribute('loading') !== 'lazy') ?? null,
          codeSnippet: '<img src="photo.webp" alt="..." loading="lazy">',
          codeLanguage: 'html',
        },
      );
    });
  },
});
