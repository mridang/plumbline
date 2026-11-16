import { Category, defineHint } from '../../core/define-hint.js';
import { onPage } from '../../core/page.js';
import { ROCTIFY_REF } from '../../lib/seo/content.js';
import { imageFormatFindings } from '../../lib/technical/speed.js';
import { reportFindings } from '../seo/report-findings.js';

/** Matches a run of whitespace. */
const WHITESPACE_RUN = /\s+/;

/** Matches a modern image MIME type (WebP, AVIF or JPEG XL). */
const MODERN_IMAGE_TYPE = /image\/(webp|avif|jxl)/i;

/** Matches a legacy raster image file extension at the end of a URL path. */
const LEGACY_IMAGE_EXTENSION = /\.(jpe?g|png|gif|bmp)(?:[?#]|$)/i;

/** Every URL an <img> can load: its src and the srcset candidates. */
function urlsOf(src: string, srcset: string): string[] {
  const candidates = srcset
    .split(',')
    .map((part) => part.trim().split(WHITESPACE_RUN, 1)[0])
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
              MODERN_IMAGE_TYPE.test(source.getAttribute('type') ?? ''),
            ),
          })),
        ),
        {
          element: images.find((img) =>
            LEGACY_IMAGE_EXTENSION.test(img.getAttribute('src') ?? ''),
          ),
        },
      );
    });
  },
});
