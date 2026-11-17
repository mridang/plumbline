/** Matches a run of whitespace or commas. */
const WHITESPACE_OR_COMMA_RUN = /[\s,]+/u;

/** Matches an opening SVG tag. */
const SVG_OPEN_TAG = /<svg\b[^>]*>/iu;

/** Matches a pixel length such as `100px`. */
const PIXEL_LENGTH = /^([\d.]+)\s*(?:px)?$/iu;
/**
 * Reads the format and pixel size of an image from its header bytes, in pure
 * TypeScript. Supports PNG, JPEG, GIF, WebP and SVG.
 */

type ImageFormat = 'png' | 'jpeg' | 'gif' | 'webp' | 'svg';

export interface ImageInfo {
  format: ImageFormat;
  width: number;
  height: number;
}

const ascii = (b: Uint8Array, start: number, end: number): string =>
  String.fromCodePoint(...b.subarray(start, end));

/** The 14 bit field mask of a WebP lossless or lossy size. */

const MASK_14_BITS = 0x3f_ff;

/** SOF0..SOF15 without DHT (C4), JPG (C8) and DAC (CC), which carry no size. */

const SOF_EXCLUDED = new Set([0xc4, 0xc8, 0xcc]);

function png(b: Uint8Array): ImageInfo | null {
  // 8 byte signature, then the IHDR chunk with big endian width and height.
  if (b.length < 24 || ascii(b, 1, 4) !== 'PNG') {
    return null;
  }
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { format: 'png', width: v.getUint32(16), height: v.getUint32(20) };
}

function gif(b: Uint8Array): ImageInfo | null {
  // Little endian logical screen size right after the 6 byte signature.
  if (b.length < 10) {
    return null;
  }
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return {
    format: 'gif',
    width: v.getUint16(6, true),
    height: v.getUint16(8, true),
  };
}

function jpeg(b: Uint8Array): ImageInfo | null {
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // eslint-disable-next-line functional/no-let -- byte cursor over an untrusted file; recursion could overflow the stack
  let index = 2;
  // Walk the marker segments until a start-of-frame marker is found.
  // eslint-disable-next-line functional/no-loop-statements -- scans bytes of an untrusted file with an unbounded step count
  while (index + 9 < b.length) {
    const marker = b[index + 1];

    if (b[index] !== 0xff || marker === 0xff) {
      index += 1;
      continue;
    }
    // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the size.

    if (marker >= 0xc0 && marker <= 0xcf && !SOF_EXCLUDED.has(marker)) {
      return {
        format: 'jpeg',
        height: v.getUint16(index + 5),
        width: v.getUint16(index + 7),
      };
    }
    index += 2 + v.getUint16(index + 2);
  }
  return null;
}

function webp(b: Uint8Array): ImageInfo | null {
  if (b.length < 30) {
    return null;
  }
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const kind = ascii(b, 12, 16);
  if (kind === 'VP8X') {
    // 24 bit little endian "canvas size minus one" values.
    return {
      format: 'webp',
      width: 1 + v.getUint16(24, true) + b[26] * 0x1_00_00,
      height: 1 + v.getUint16(27, true) + b[29] * 0x1_00_00,
    };
  }
  if (kind === 'VP8L') {
    // 14 bit width and height minus one, packed after the 0x2f signature.
    const bits = v.getUint32(21, true);
    return {
      format: 'webp',
      width: 1 + (bits % (MASK_14_BITS + 1)),
      height: 1 + (Math.floor(bits / (MASK_14_BITS + 1)) % (MASK_14_BITS + 1)),
    };
  }
  if (kind === 'VP8 ') {
    // Lossy: 14 bit sizes after the 3 byte frame tag and 3 byte start code.
    return {
      format: 'webp',
      width: v.getUint16(26, true) % (MASK_14_BITS + 1),
      height: v.getUint16(28, true) % (MASK_14_BITS + 1),
    };
  }
  return null;
}

/** Parses a CSS length such as `1200` or `630px`; other units are rejected. */
function svgLength(value: string | undefined): number | null {
  const m = PIXEL_LENGTH.exec((value ?? '').trim());
  return m ? Number(m[1]) : null;
}

function svg(text: string): ImageInfo | null {
  const tag = SVG_OPEN_TAG.exec(text)?.[0];
  if (!tag) {
    return null;
  }
  const attribute = (name: string) =>
    new RegExp(String.raw`\s${name}\s*=\s*["']([^"']*)["']`, 'iu').exec(
      tag,
    )?.[1];
  const declaredWidth = svgLength(attribute('width'));
  const declaredHeight = svgLength(attribute('height'));
  // Fall back to the viewBox when width/height are missing or relative.
  const box =
    declaredWidth === null || declaredHeight === null
      ? attribute('viewBox')?.trim().split(WHITESPACE_OR_COMMA_RUN).map(Number)
      : undefined;
  const fromBox = box?.length === 4 && box.every((n) => Number.isFinite(n));
  const width = fromBox ? box[2] : declaredWidth;
  const height = fromBox ? box[3] : declaredHeight;
  return width && height ? { format: 'svg', width, height } : null;
}

/** Returns the format and size of the image, or null when unrecognised. */
export function sniffImage(bytes: Uint8Array): ImageInfo | null {
  if (bytes.length < 4) {
    return null;
  }
  if (bytes[0] === 0x89 && ascii(bytes, 1, 4) === 'PNG') {
    return png(bytes);
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    return jpeg(bytes);
  }
  if (ascii(bytes, 0, 3) === 'GIF') {
    return gif(bytes);
  }
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
    return webp(bytes);
  }
  // SVG is text; look at the start of the file only.
  return svg(Buffer.from(bytes.subarray(0, 4096)).toString('utf8'));
}
