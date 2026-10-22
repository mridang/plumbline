import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import type { DocumentLike } from '../../../src/lib/pwa/read.js';
import {
  getManifestHref,
  getThemeColorMeta,
  isAbsoluteHref,
} from '../../../src/lib/pwa/read.js';

const require = createRequire(import.meta.url);
const { createHTMLDocument } = require('@hint/utils-dom');

/** Parses markup with the same DOM implementation webhint uses. */
const parse = (html: string): DocumentLike =>
  createHTMLDocument(html, 'http://example.com/') as DocumentLike;

describe('getManifestHref', () => {
  it('returns the trimmed href of the manifest link', () => {
    expect(
      getManifestHref(parse('<link rel="manifest" href=" /app.webmanifest ">')),
    ).toBe('/app.webmanifest');
  });

  it('matches a rel with extra tokens, case-insensitively', () => {
    expect(
      getManifestHref(parse('<link rel="MANIFEST foo" href="/m.json">')),
    ).toBe('/m.json');
  });

  it('returns null when there is no link or the href is empty', () => {
    expect(getManifestHref(parse('<head></head>'))).toBeNull();
    expect(getManifestHref(parse('<link rel="manifest" href="">'))).toBeNull();
  });
});

describe('isAbsoluteHref', () => {
  it('accepts full, protocol-relative and root-relative references', () => {
    expect(isAbsoluteHref('https://x.test/m.json')).toBe(true);
    expect(isAbsoluteHref('//x.test/m.json')).toBe(true);
    expect(isAbsoluteHref('/m.webmanifest')).toBe(true);
  });

  it('rejects document-relative references', () => {
    expect(isAbsoluteHref('manifest.json')).toBe(false);
    expect(isAbsoluteHref('./manifest.json')).toBe(false);
    expect(isAbsoluteHref('../manifest.json')).toBe(false);
  });
});

describe('getThemeColorMeta', () => {
  it('returns the trimmed content of the theme-color meta', () => {
    expect(
      getThemeColorMeta(parse('<meta name="theme-color" content=" #fff ">')),
    ).toBe('#fff');
  });

  it('returns null when the meta is absent or empty', () => {
    expect(getThemeColorMeta(parse('<head></head>'))).toBeNull();
    expect(
      getThemeColorMeta(parse('<meta name="theme-color" content="">')),
    ).toBeNull();
  });
});
