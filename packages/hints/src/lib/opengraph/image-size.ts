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
  String.fromCharCode(...b.subarray(start, end));

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
  let i = 2;
  // Walk the marker segments until a start-of-frame marker is found.
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1];
    if (marker === 0xff) {
      i += 1;
      continue;
    }
    // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC) carry the size.
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        format: 'jpeg',
        height: v.getUint16(i + 5),
        width: v.getUint16(i + 7),
      };
    }
    i += 2 + v.getUint16(i + 2);
  }
  return null;
}

function webp(b: Uint8Array): ImageInfo | null {
  if (b.length < 30) {
    return null;
  }
  const kind = ascii(b, 12, 16);
  if (kind === 'VP8X') {
    // 24 bit little endian "canvas size minus one" values.
    return {
      format: 'webp',
      width: 1 + (b[24] | (b[25] << 8) | (b[26] << 16)),
      height: 1 + (b[27] | (b[28] << 8) | (b[29] << 16)),
    };
  }
  if (kind === 'VP8L') {
    // 14 bit width and height minus one, packed after the 0x2f signature.
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return {
      format: 'webp',
      width: 1 + (bits & 0x3F_FF),
      height: 1 + ((bits >> 14) & 0x3F_FF),
    };
  }
  if (kind === 'VP8 ') {
    // Lossy: 14 bit sizes after the 3 byte frame tag and 3 byte start code.
    return {
      format: 'webp',
      width: (b[26] | (b[27] << 8)) & 0x3F_FF,
      height: (b[28] | (b[29] << 8)) & 0x3F_FF,
    };
  }
  return null;
}

/** Parses a CSS length such as `1200` or `630px`; other units are rejected. */
function svgLength(value: string | undefined): number | null {
  const m = /^\s*([\d.]+)\s*(px)?\s*$/i.exec(value ?? '');
  return m ? Number(m[1]) : null;
}

function svg(text: string): ImageInfo | null {
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0];
  if (!tag) {
    return null;
  }
  const attr = (name: string) =>
    new RegExp(String.raw`\s${name}\s*=\s*["']([^"']*)["']`, 'i').exec(
      tag,
    )?.[1];
  let width = svgLength(attr('width'));
  let height = svgLength(attr('height'));
  if (width === null || height === null) {
    // Fall back to the viewBox when width/height are missing or relative.
    const box = attr('viewBox')
      ?.trim()
      .split(/[\s,]+/)
      .map(Number);
    if (box?.length === 4 && box.every(Number.isFinite)) {
      width = box[2];
      height = box[3];
    }
  }
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
