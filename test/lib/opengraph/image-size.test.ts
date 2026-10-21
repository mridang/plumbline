import { describe, expect, it } from '@jest/globals';
import { sniffImage } from '../../../src/lib/opengraph/image-size.js';

const bytes = (...n: number[]) => new Uint8Array(n);
const be32 = (n: number) => [
  n >>> 24,
  (n >> 16) & 255,
  (n >> 8) & 255,
  n & 255,
];
const le16 = (n: number) => [n & 255, n >> 8];
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

describe('sniffImage', () => {
  it('reads a PNG', () => {
    const png = bytes(
      0x89,
      ...ascii('PNG\r\n'),
      0x1a,
      0x0a,
      0,
      0,
      0,
      13,
      ...ascii('IHDR'),
      ...be32(1200),
      ...be32(630),
    );
    expect(sniffImage(png)).toEqual({
      format: 'png',
      width: 1200,
      height: 630,
    });
  });

  it('reads a GIF', () => {
    const gif = bytes(...ascii('GIF89a'), ...le16(320), ...le16(200));
    expect(sniffImage(gif)).toEqual({ format: 'gif', width: 320, height: 200 });
  });

  it('reads a JPEG, skipping earlier segments', () => {
    const jpeg = bytes(
      0xff,
      0xd8,
      0xff,
      0xe0,
      0,
      4,
      0,
      0, // APP0 segment of length 4
      0xff,
      0xc0,
      0,
      17,
      8,
      0x02,
      0x76,
      0x04,
      0xb0,
      3, // SOF0: 630 high, 1200 wide
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
    );
    expect(sniffImage(jpeg)).toEqual({
      format: 'jpeg',
      width: 1200,
      height: 630,
    });
  });

  it('returns null for a truncated JPEG', () => {
    expect(sniffImage(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 4))).toBeNull();
  });

  const riff = (kind: string, payload: number[]) =>
    bytes(
      ...ascii('RIFF'),
      0,
      0,
      0,
      0,
      ...ascii('WEBP'),
      ...ascii(kind),
      0,
      0,
      0,
      0,
      ...payload,
      ...new Array(20).fill(0),
    );

  it('reads a lossy WebP (VP8)', () => {
    // 10 bytes of frame tag and start code, then sizes at offsets 26 and 28.
    const webp = riff('VP8 ', [
      0,
      0,
      0,
      0x9d,
      0x01,
      0x2a,
      ...le16(1200),
      ...le16(630),
    ]);
    expect(sniffImage(webp)).toEqual({
      format: 'webp',
      width: 1200,
      height: 630,
    });
  });

  it('reads an extended WebP (VP8X)', () => {
    // Flags (4 bytes), then 24 bit width-1 and height-1 at offsets 24 and 27.
    const webp = riff('VP8X', [
      0,
      0,
      0,
      0,
      1199 & 255,
      1199 >> 8,
      0,
      629 & 255,
      629 >> 8,
      0,
    ]);
    expect(sniffImage(webp)).toEqual({
      format: 'webp',
      width: 1200,
      height: 630,
    });
  });

  it('reads a lossless WebP (VP8L)', () => {
    // Signature 0x2f at offset 20, then 14 bit width-1 and height-1.
    const bits = 1199 | (629 << 14);
    const webp = riff('VP8L', [
      0x2f,
      bits & 255,
      (bits >> 8) & 255,
      (bits >> 16) & 255,
      (bits >>> 24) & 255,
    ]);
    expect(sniffImage(webp)).toEqual({
      format: 'webp',
      width: 1200,
      height: 630,
    });
  });

  it('returns null for an unknown WebP chunk', () => {
    expect(sniffImage(riff('XXXX', []))).toBeNull();
  });

  it('reads an SVG from width and height', () => {
    const svg = Buffer.from(
      '<svg xmlns="x" width="1200px" height=\'630\'></svg>',
    );
    expect(sniffImage(svg)).toEqual({
      format: 'svg',
      width: 1200,
      height: 630,
    });
  });

  it('reads an SVG from its viewBox when sizes are relative', () => {
    const svg = Buffer.from(
      '<?xml version="1.0"?><svg width="100%" viewBox="0 0 800 400"></svg>',
    );
    expect(sniffImage(svg)).toEqual({ format: 'svg', width: 800, height: 400 });
  });

  it('returns null for an SVG without a size', () => {
    expect(sniffImage(Buffer.from('<svg></svg>'))).toBeNull();
  });

  it('returns null for other content and tiny input', () => {
    expect(sniffImage(Buffer.from('<html></html>'))).toBeNull();
    expect(sniffImage(bytes(1, 2))).toBeNull();
  });
});
