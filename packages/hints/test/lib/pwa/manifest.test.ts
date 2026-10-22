import { describe, expect, it } from '@jest/globals';
import {
  hasNonEmptyArray,
  hasPngIconOfSize,
  iconHasSize,
  isPngIcon,
  isValidColor,
  isValidDisplay,
  parseManifest,
  readIcons,
  readString,
  type ManifestIcon,
} from '../../../src/lib/pwa/manifest.js';

const icon = (over: Partial<ManifestIcon> = {}): ManifestIcon => ({
  src: 'i.png',
  sizes: '192x192',
  type: 'image/png',
  purpose: '',
  ...over,
});

describe('parseManifest', () => {
  it('parses a JSON object', () => {
    expect(parseManifest('{"name":"A"}')).toEqual({ name: 'A' });
  });

  it('returns null for invalid JSON or a non-object', () => {
    expect(parseManifest('not json')).toBeNull();
    expect(parseManifest('[]')).toBeNull();
    expect(parseManifest('"a string"')).toBeNull();
  });
});

describe('readString', () => {
  it('returns a trimmed non-empty string, else null', () => {
    expect(readString({ name: '  A  ' }, 'name')).toBe('A');
    expect(readString({ name: '   ' }, 'name')).toBeNull();
    expect(readString({ name: 5 }, 'name')).toBeNull();
    expect(readString({}, 'name')).toBeNull();
  });
});

describe('readIcons', () => {
  it('reads valid entries and drops malformed ones', () => {
    const icons = readIcons({
      icons: [
        { src: 'a.png', sizes: '192x192', type: 'image/png' },
        { sizes: '512x512' },
        'nope',
        { src: '  ' },
      ],
    });
    expect(icons).toHaveLength(1);
    expect(icons[0].src).toBe('a.png');
  });

  it('returns an empty list when icons is absent or not an array', () => {
    expect(readIcons({})).toEqual([]);
    expect(readIcons({ icons: 'x' })).toEqual([]);
  });
});

describe('isPngIcon', () => {
  it('uses the declared type, else the file extension', () => {
    expect(isPngIcon(icon({ type: 'image/png' }))).toBe(true);
    expect(isPngIcon(icon({ type: 'image/webp', src: 'a.png' }))).toBe(false);
    expect(isPngIcon(icon({ type: '', src: 'a.PNG?v=2' }))).toBe(true);
    expect(isPngIcon(icon({ type: '', src: 'a.svg' }))).toBe(false);
  });
});

describe('iconHasSize', () => {
  it('matches an exact square size or any', () => {
    expect(iconHasSize(icon({ sizes: '48x48 192x192' }), 192)).toBe(true);
    expect(iconHasSize(icon({ sizes: 'any' }), 512)).toBe(true);
    expect(iconHasSize(icon({ sizes: '48x48' }), 192)).toBe(false);
  });
});

describe('hasPngIconOfSize', () => {
  it('needs a PNG of the exact size (or any)', () => {
    expect(hasPngIconOfSize([icon({ sizes: '192x192' })], 192)).toBe(true);
    expect(
      hasPngIconOfSize([icon({ type: 'image/svg+xml', sizes: 'any' })], 192),
    ).toBe(false);
    expect(hasPngIconOfSize([icon({ sizes: 'any' })], 512)).toBe(true);
  });
});

describe('isValidDisplay', () => {
  it('accepts the four display modes, case-insensitively', () => {
    expect(isValidDisplay('standalone')).toBe(true);
    expect(isValidDisplay('MINIMAL-UI')).toBe(true);
    expect(isValidDisplay('window')).toBe(false);
    expect(isValidDisplay(5)).toBe(false);
  });
});

describe('isValidColor', () => {
  it('accepts hex, functional and named colours', () => {
    expect(isValidColor('#fff')).toBe(true);
    expect(isValidColor('#ffffffaa')).toBe(true);
    expect(isValidColor('rgb(0, 0, 0)')).toBe(true);
    expect(isValidColor('rebeccapurple')).toBe(true);
  });

  it('rejects empty, non-string and clearly invalid values', () => {
    expect(isValidColor('')).toBe(false);
    expect(isValidColor('#12')).toBe(false);
    expect(isValidColor(123)).toBe(false);
    expect(isValidColor('12345')).toBe(false);
  });
});

describe('hasNonEmptyArray', () => {
  it('is true only for a present non-empty array', () => {
    expect(hasNonEmptyArray({ a: [1] }, 'a')).toBe(true);
    expect(hasNonEmptyArray({ a: [] }, 'a')).toBe(false);
    expect(hasNonEmptyArray({}, 'a')).toBe(false);
  });
});
