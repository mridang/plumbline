import { describe, expect, it } from '@jest/globals';
import { createHTMLDocument } from '@hint/utils-dom';
import {
  getIconLinks,
  isIcoIcon,
  isPng32Icon,
  isPngIcon,
  isSvgIcon,
} from '../../../src/lib/seo/icons.js';
import type { DocumentLike } from '../../../src/lib/seo/read.js';

const parse = (html: string): DocumentLike =>
  createHTMLDocument(html, 'https://example.com/') as DocumentLike;

describe('getIconLinks', () => {
  it('reads icon and shortcut icon but not apple-touch-icon', () => {
    const links = getIconLinks(
      parse(
        '<link rel="icon" href="/a.png" type="IMAGE/PNG" sizes="32x32">' +
          '<link rel="shortcut icon" href="/favicon.ico">' +
          '<link rel="apple-touch-icon" href="/t.png">' +
          '<link rel="icon" href=" ">',
      ),
    );
    expect(links).toEqual([
      { href: '/a.png', type: 'image/png', sizes: '32x32' },
      { href: '/favicon.ico', type: '', sizes: '' },
    ]);
  });
});

describe('icon classifiers', () => {
  const icon = (href: string, type = '', sizes = '') => ({ href, type, sizes });
  it('detects svg', () => {
    expect(isSvgIcon(icon('/a.svg?v=1'))).toBe(true);
    expect(isSvgIcon(icon('/a', 'image/svg+xml'))).toBe(true);
    expect(isSvgIcon(icon('/a.png'))).toBe(false);
  });
  it('detects ico', () => {
    expect(isIcoIcon(icon('/favicon.ICO'))).toBe(true);
    expect(isIcoIcon(icon('/a', 'image/x-icon'))).toBe(true);
    expect(isIcoIcon(icon('/a', 'image/vnd.microsoft.icon'))).toBe(true);
    expect(isIcoIcon(icon('/a.png'))).toBe(false);
  });
  it('detects png and 32x32 png', () => {
    expect(isPngIcon(icon('/a.png'))).toBe(true);
    expect(isPngIcon(icon('/a', 'image/png'))).toBe(true);
    expect(isPngIcon(icon('/a.svg'))).toBe(false);
    expect(isPng32Icon(icon('/a.png', '', '16x16 32x32'))).toBe(true);
    expect(isPng32Icon(icon('/a.png', '', '16x16'))).toBe(false);
    expect(isPng32Icon(icon('/a.svg', '', '32x32'))).toBe(false);
  });
});
