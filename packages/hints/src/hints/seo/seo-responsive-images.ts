import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { ROCTIFY_REF } from '../../lib/seo/content.js';
import { responsiveImageFindings } from '../../lib/seo/mobile.js';
import { reportFindings } from './report-findings.js';

/**
 * Warns when most images have neither a srcset nor a <picture>. Source:
 * Roctify SEO checker "Responsive images". SVG and inline images are ignored.
 */
export default defineHint({
  id: 'seo-responsive-images',
  name: 'Images are responsive',
  description: 'Warns when most images have no srcset or picture element.',
  category: Category.development,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      const images = [...page.document.querySelectorAll('img')];
      reportFindings(
        page,
        responsiveImageFindings(
          images.map((img) => ({
            src: img.getAttribute('src') ?? '',
            srcset: img.getAttribute('srcset') ?? '',
            inPicture: img.parentElement?.nodeName.toLowerCase() === 'picture',
          })),
        ),
        { element: page.document.querySelector('img:not([srcset])') },
      );
    });
  },
});
