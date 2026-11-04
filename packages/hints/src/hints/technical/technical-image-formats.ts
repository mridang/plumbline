import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { ROCTIFY_REF } from '../../lib/seo/content.js';
import { imageFormatFindings } from '../../lib/technical/speed.js';
import { reportFindings } from '../seo/report-findings.js';

/** Every URL an <img> can load: its src and the srcset candidates. */
function urlsOf(src: string, srcset: string): string[] {
  const candidates = srcset
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter((url) => url !== '');
  return [src, ...candidates].filter((url) => url !== '');
}

/**
 * Warns when images are only JPEG, PNG or GIF. Source: Roctify SEO checker
 * "Modern image formats". WebP and AVIF, whether in src, srcset or a
 * <picture> source, count as modern.
 */
export default defineHint({
  id: 'technical-image-formats',
  name: 'Images use modern formats',
  description: 'Warns when images ship only as JPEG, PNG or GIF.',
  category: Category.performance,
  groups: ['roctify', 'seo'],
  reference: ROCTIFY_REF,
  setup(context) {
    onPage(context, (page) => {
      const images = [...page.document.querySelectorAll('img')];
      reportFindings(
        page,
        imageFormatFindings(
          images.map((img) => ({
            urls: urlsOf(
              img.getAttribute('src') ?? '',
              img.getAttribute('srcset') ?? '',
            ),
            hasModernSource: [
              ...(img.parentElement?.querySelectorAll('source') ?? []),
            ].some((source) =>
              /image\/(webp|avif|jxl)/i.test(source.getAttribute('type') ?? ''),
            ),
          })),
        ),
        {
          element: images.find((img) =>
            /\.(jpe?g|png|gif|bmp)(?:[?#]|$)/i.test(
              img.getAttribute('src') ?? '',
            ),
          ),
        },
      );
    });
  },
});
