import { describe, expect, it } from '@jest/globals';
import { createHTMLDocument } from '@hint/utils-dom';
import type { DocumentLike } from '../../../src/lib/pwa/read.js';
import {
  manifestIcons,
  manifestLinked,
  manifestValid,
  themeColorMeta,
  MANIFEST_ICONS_REF,
  MANIFEST_LINKED_REF,
  MANIFEST_VALID_REF,
  THEME_COLOR_META_REF,
} from '../../../src/lib/pwa/checks.js';

const parse = (html: string): DocumentLike =>
  // eslint-disable-next-line unicorn/prefer-https -- test fixture
  createHTMLDocument(html, 'http://example.com/') as DocumentLike;

/** A fully valid manifest; tests delete or override one member at a time. */
const fullManifest = (): Record<string, unknown> => ({
  name: 'Example',
  short_name: 'Ex',
  start_url: '/',
  display: 'standalone',
  theme_color: '#ffffff',
  background_color: '#000000',
  id: '/',
  scope: '/',
  description: 'An example app',
  shortcuts: [{ name: 'Home', url: '/' }],
  screenshots: [{ src: 's.png' }],
  icons: [
    { src: 'a-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'a-512.png', sizes: '512x512', type: 'image/png' },
  ],
});

const json = (m: Record<string, unknown>): string => JSON.stringify(m);

describe('manifestLinked', () => {
  it('errors with the reference when there is no manifest link', () => {
    const [found] = manifestLinked(parse('<head></head>'));
    expect(found?.severity).toBe('error');
    expect(found?.message).toContain('links no Web App Manifest');
    expect(found?.message).toContain(MANIFEST_LINKED_REF);
  });

  it('warns when the manifest href is document-relative', () => {
    const [found] = manifestLinked(
      parse('<link rel="manifest" href="manifest.json">'),
    );
    expect(found?.severity).toBe('warning');
    expect(found?.message).toContain('document-relative');
  });

  it('passes with an absolute manifest link', () => {
    expect(
      manifestLinked(parse('<link rel="manifest" href="/m.webmanifest">')),
    ).toEqual([]);
  });
});

describe('themeColorMeta', () => {
  it('hints with the reference when the meta is missing', () => {
    const [found] = themeColorMeta(parse('<head></head>'));
    expect(found?.severity).toBe('hint');
    expect(found?.message).toContain('theme-color');
    expect(found?.message).toContain(THEME_COLOR_META_REF);
  });

  it('passes when a theme-color meta is present', () => {
    expect(
      themeColorMeta(parse('<meta name="theme-color" content="#fff">')),
    ).toEqual([]);
  });
});

describe('manifestValid', () => {
  const CT = 'application/manifest+json';

  it('passes a complete manifest served correctly', () => {
    expect(manifestValid(json(fullManifest()), CT)).toEqual([]);
  });

  it('errors once when the body is not a JSON object', () => {
    const found = manifestValid('not json', CT);
    expect(found).toHaveLength(1);
    expect(found[0].severity).toBe('error');
    expect(found[0].message).toContain('not valid JSON');
    expect(found[0].message).toContain(MANIFEST_VALID_REF);
  });

  it('warns on the wrong media type', () => {
    const found = manifestValid(json(fullManifest()), 'application/json');
    expect(
      found.some(
        (f) =>
          f.severity === 'warning' && f.message.includes('application/json'),
      ),
    ).toBe(true);
  });

  it('errors when both name and short_name are missing', () => {
    const m = fullManifest();
    delete m.name;
    delete m.short_name;
    const found = manifestValid(json(m), CT);
    expect(
      found.some((f) => f.message.includes('no "name" or "short_name"')),
    ).toBe(true);
  });

  it('accepts short_name alone', () => {
    const m = fullManifest();
    delete m.name;
    expect(manifestValid(json(m), CT)).toEqual([]);
  });

  it('errors on a missing start_url, display, theme_color and background_color', () => {
    const m = fullManifest();
    delete m.start_url;
    delete m.display;
    delete m.theme_color;
    delete m.background_color;
    const found = manifestValid(json(m), CT);
    const errors = found.filter((f) => f.severity === 'error');
    expect(errors.map((f) => f.message).join('\n')).toContain('no "start_url"');
    expect(errors.map((f) => f.message).join('\n')).toContain('no "display"');
    expect(errors.map((f) => f.message).join('\n')).toContain(
      'no "theme_color"',
    );
    expect(errors.map((f) => f.message).join('\n')).toContain(
      'no "background_color"',
    );
  });

  it('errors on an invalid display value', () => {
    const m = fullManifest();
    m.display = 'window';
    const found = manifestValid(json(m), CT);
    expect(
      found.some(
        (f) =>
          f.severity === 'error' && f.message.includes('"display" is invalid'),
      ),
    ).toBe(true);
  });

  it('warns on an invalid colour', () => {
    const m = fullManifest();
    m.theme_color = 'notacolour123';
    const found = manifestValid(json(m), CT);
    expect(
      found.some(
        (f) => f.severity === 'warning' && f.message.includes('theme_color'),
      ),
    ).toBe(true);
  });

  it('errors when the icons member is missing or empty', () => {
    const m = fullManifest();
    m.icons = [];
    const found = manifestValid(json(m), CT);
    expect(
      found.some(
        (f) => f.severity === 'error' && f.message.includes('no "icons"'),
      ),
    ).toBe(true);
  });

  it('hints on each missing recommended member', () => {
    const m = fullManifest();
    delete m.id;
    delete m.scope;
    delete m.shortcuts;
    delete m.screenshots;
    delete m.description;
    const hints = manifestValid(json(m), CT).filter(
      (f) => f.severity === 'hint',
    );
    expect(hints).toHaveLength(5);
    for (const key of [
      'id',
      'scope',
      'shortcuts',
      'screenshots',
      'description',
    ]) {
      expect(hints.some((f) => f.message.includes(`"${key}"`))).toBe(true);
    }
  });
});

describe('manifestIcons', () => {
  it('passes when a 192 and a 512 PNG are declared', () => {
    expect(manifestIcons(json(fullManifest()))).toEqual([]);
  });

  it('errors for each missing size', () => {
    const found = manifestIcons(json({ icons: [] }));
    expect(found).toHaveLength(2);
    expect(found.every((f) => f.severity === 'error')).toBe(true);
    expect(found[0].message).toContain('192x192');
    expect(found[0].message).toContain(MANIFEST_ICONS_REF);
    expect(found[1].message).toContain('512x512');
  });

  it('accepts an any-sized PNG for both sizes', () => {
    expect(
      manifestIcons(
        json({ icons: [{ src: 'i.png', sizes: 'any', type: 'image/png' }] }),
      ),
    ).toEqual([]);
  });

  it('is quiet on an unparsable manifest (manifestValid owns that)', () => {
    expect(manifestIcons('not json')).toEqual([]);
  });
});
