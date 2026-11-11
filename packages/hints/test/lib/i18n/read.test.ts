import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import {
  getAlternateMediaLinks,
  getHreflangLinks,
  getPaginationLinks,
  isAbsoluteHttpUrl,
  isValidHreflang,
  sameUrl,
  type DocumentLike,
} from '../../../src/lib/i18n/read.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line sonarjs/no-require-or-define -- @hint/utils-dom is CommonJS only, loaded through createRequire
const { createHTMLDocument } = require('@hint/utils-dom');

/** Parses markup with the same DOM implementation the webhint hints use. */
const parse = (html: string): DocumentLike =>
  createHTMLDocument(
    `<!doctype html><html><head>${html}</head><body></body></html>`,
    'https://x.test/',
  ) as DocumentLike;

describe('getHreflangLinks', () => {
  it('returns hreflang alternates in document order with trimmed values', () => {
    const links = getHreflangLinks(
      parse(
        '<link rel="alternate" hreflang=" en " href=" https://x.test/ ">' +
          '<link rel="alternate" hreflang="fr" href="https://x.test/fr">',
      ),
    );
    expect(links.map((l) => l.hreflang)).toEqual(['en', 'fr']);
    expect(links[0].href).toBe('https://x.test/');
  });

  it('matches alternate even among several rel tokens', () => {
    const links = getHreflangLinks(
      parse('<link rel="alternate stylesheet" hreflang="de" href="/de">'),
    );
    expect(links).toHaveLength(1);
    expect(links[0].hreflang).toBe('de');
  });

  it('ignores alternate links without an hreflang attribute', () => {
    expect(
      getHreflangLinks(parse('<link rel="alternate" media="print" href="/p">')),
    ).toHaveLength(0);
  });
});

describe('getAlternateMediaLinks', () => {
  it('returns alternate links that carry a media attribute', () => {
    const links = getAlternateMediaLinks(
      parse(
        '<link rel="alternate" media="only screen and (max-width: 640px)" href="https://m.x.test/">',
      ),
    );
    expect(links).toHaveLength(1);
    expect(links[0].media).toBe('only screen and (max-width: 640px)');
    expect(links[0].href).toBe('https://m.x.test/');
  });

  it('ignores alternate links without a media attribute', () => {
    expect(
      getAlternateMediaLinks(
        parse('<link rel="alternate" hreflang="en" href="/en">'),
      ),
    ).toHaveLength(0);
  });
});

describe('getPaginationLinks', () => {
  it('returns prev links first, then next links', () => {
    const links = getPaginationLinks(
      parse(
        '<link rel="next" href="https://x.test/2">' +
          '<link rel="prev" href="https://x.test/0">',
      ),
    );
    expect(links.map((l) => l.rel)).toEqual(['prev', 'next']);
  });

  it('reads the href of each pagination link', () => {
    const [link] = getPaginationLinks(
      parse('<link rel="prev" href=" https://x.test/0 ">'),
    );
    expect(link.href).toBe('https://x.test/0');
  });
});

describe('isValidHreflang', () => {
  it.each(['x-default', 'X-Default', 'en', 'EN', 'en-US', 'pt-BR'])(
    'accepts %s',
    (value) => {
      expect(isValidHreflang(value)).toBe(true);
    },
  );

  it.each(['en_US', 'eng', 'e', 'english', 'en-USA', 'en-U', '', 'default'])(
    'rejects %s',
    (value) => {
      expect(isValidHreflang(value)).toBe(false);
    },
  );
});

describe('isAbsoluteHttpUrl', () => {
  // eslint-disable-next-line unicorn/prefer-https -- test fixture
  it.each(['https://x.test/', 'http://x.test/a?b#c'])(
    'accepts absolute %s',
    (href) => {
      expect(isAbsoluteHttpUrl(href)).toBe(true);
    },
  );

  it.each(['/relative', '//x.test/a', 'mailto:a@b.test', 'ftp://x.test/', ''])(
    'rejects non-absolute-http %s',
    (href) => {
      expect(isAbsoluteHttpUrl(href)).toBe(false);
    },
  );
});

describe('sameUrl', () => {
  it('treats a relative value resolved against the base as equal', () => {
    expect(sameUrl('/fr', 'https://x.test/fr')).toBe(true);
  });

  it('ignores the fragment', () => {
    expect(sameUrl('https://x.test/a#top', 'https://x.test/a')).toBe(true);
  });

  it('is false for a different path', () => {
    expect(sameUrl('https://x.test/a', 'https://x.test/b')).toBe(false);
  });

  it('is false when a value cannot be parsed', () => {
    expect(sameUrl('::::', 'https://x.test/')).toBe(false);
  });
});
