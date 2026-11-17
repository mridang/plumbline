/**
 * Mobile rules ported from the Roctify SEO checker
 * (https://roctify.com/tools/seo-checker): the viewport, responsive images
 * and the Apple touch icon. Pure functions over plain values.
 */
import { finding } from '../headers/finding.js';
import type { Finding } from '../headers/finding.js';

/** Matches an `.svg` file extension. */
const SVG_EXTENSION = /\.svg(?:[?#]|$)/iu;

/** Matches a `data:` URI prefix. */
const DATA_URI_PREFIX = /^data:/iu;

/** Matches a comma or semicolon. */
const COMMA_OR_SEMICOLON = /[,;]/u;

/** Parses a viewport `content` into lower-cased key/value pairs. */
function viewportDirectives(content: string): Map<string, string> {
  return new Map(
    content.split(COMMA_OR_SEMICOLON).flatMap((part): [string, string][] => {
      const [key, value = ''] = part.split('=');
      return key.trim() === ''
        ? []
        : [[key.trim().toLowerCase(), value.trim().toLowerCase()]];
    }),
  );
}

/**
 * Checks `<meta name="viewport">`. `content` is the tag's content, or null
 * when the tag is absent. Google indexes the mobile version first, so a page
 * without `width=device-width` is shown zoomed out on a phone.
 */
export function viewportFindings(content: string | null): Finding[] {
  if (content === null) {
    return [
      finding(
        'error',
        'The page has no <meta name="viewport">, so phones show it zoomed out.',
      ),
    ];
  }
  const directives = viewportDirectives(content);
  const scale = Number.parseFloat(directives.get('maximum-scale') ?? '');
  return [
    ...(directives.get('width') === 'device-width'
      ? []
      : [
          finding(
            'warning',
            'The viewport does not set width=device-width, so the layout does not follow the screen width.',
          ),
        ]),
    ...(['no', '0', 'false'].includes(directives.get('user-scalable') ?? '') ||
    (Number.isFinite(scale) && scale < 2)
      ? [
          finding(
            'warning',
            'The viewport stops visitors from zooming (user-scalable=no or a low maximum-scale).',
          ),
        ]
      : []),
  ];
}

/** What the responsive-image check needs to know about an `<img>`. */
export interface ImageSource {
  src: string;
  srcset: string;
  /** True when the image sits inside a `<picture>`. */
  inPicture: boolean;
}

/** True for images that do not scale in pixels (vector or inline). */
function isFixedFormat(src: string): boolean {
  return DATA_URI_PREFIX.test(src) || SVG_EXTENSION.test(src);
}

/** Warns when most raster images offer no `srcset` or `<picture>`. */
export function responsiveImageFindings(
  images: readonly ImageSource[],
): Finding[] {
  const raster = images.filter(
    (image) => image.src !== '' && !isFixedFormat(image.src),
  );
  if (raster.length === 0) {
    return [];
  }
  const fixed = raster.filter(
    (image) => image.srcset.trim() === '' && !image.inPicture,
  );
  if (fixed.length * 2 <= raster.length) {
    return [];
  }
  return [
    finding(
      'warning',
      `${fixed.length} of ${raster.length} images have no srcset or <picture>, so phones download the full-size file.`,
    ),
  ];
}

/** Warns when no `apple-touch-icon` link is declared. */
export function appleTouchIconFindings(count: number): Finding[] {
  if (count > 0) {
    return [];
  }
  return [
    finding(
      'warning',
      'The page declares no apple-touch-icon, so iOS shows a blank tile when it is added to the home screen.',
    ),
  ];
}
