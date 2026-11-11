import { describe, expect, it } from '@jest/globals';
import { createHTMLDocument } from '@hint/utils-dom';
import {
  countH1,
  findRobotsSource,
  getCanonical,
  getHtmlLang,
  getMetaDescription,
  getRobotsDirectives,
  getRobotsHeaderDirectives,
  getTitle,
  hasJsonLd,
  sameUrl,
  type DocumentLike,
} from '../../../src/lib/seo/read.js';

/** Parses markup with the same DOM implementation webhint uses. */
const parse = (html: string): DocumentLike =>
  // eslint-disable-next-line unicorn/prefer-https -- test fixture
  createHTMLDocument(html, 'http://example.com/') as DocumentLike;

describe('getTitle', () => {
  it('returns the collapsed title text', () => {
    expect(getTitle(parse('<title>  A \n title </title>'))).toBe('A title');
  });
  it('returns an empty string for an empty title', () => {
    expect(getTitle(parse('<title></title>'))).toBe('');
  });
  it('returns null without a title', () => {
    expect(getTitle(parse('<head></head>'))).toBeNull();
  });
});

describe('getMetaDescription', () => {
  it('returns the content', () => {
    expect(
      getMetaDescription(parse('<meta name="description" content=" hi ">')),
    ).toBe('hi');
  });
  it('returns an empty string when content is missing', () => {
    expect(getMetaDescription(parse('<meta name="description">'))).toBe('');
  });
  it('returns null without the tag', () => {
    expect(getMetaDescription(parse('<title>x</title>'))).toBeNull();
  });
});

describe('countH1', () => {
  it('counts headings', () => {
    expect(countH1(parse('<h1>a</h1><h1>b</h1><h2>c</h2>'))).toBe(2);
    expect(countH1(parse('<h2>c</h2>'))).toBe(0);
  });
});

describe('getHtmlLang', () => {
  it('returns the language', () => {
    expect(
      getHtmlLang(parse('<html lang=" en-US "><body></body></html>')),
    ).toBe('en-US');
  });
  it('treats blank and absent as null', () => {
    expect(
      getHtmlLang(parse('<html lang=" "><body></body></html>')),
    ).toBeNull();
    expect(getHtmlLang(parse('<html><body></body></html>'))).toBeNull();
  });
});

describe('getRobotsDirectives', () => {
  it('splits and lowercases directives', () => {
    expect(
      getRobotsDirectives(
        parse('<meta name="robots" content="NoIndex, nofollow">'),
      ),
    ).toEqual(['noindex', 'nofollow']);
  });
  it('returns nothing without a tag', () => {
    expect(getRobotsDirectives(parse('<title>x</title>'))).toEqual([]);
  });
});

describe('getCanonical', () => {
  it('returns the href', () => {
    expect(getCanonical(parse('<link rel="canonical" href=" /a ">'))).toBe(
      '/a',
    );
  });
  it('returns null without the tag', () => {
    expect(getCanonical(parse('<link rel="icon" href="/a">'))).toBeNull();
  });
});

describe('hasJsonLd', () => {
  it('detects a block', () => {
    expect(
      hasJsonLd(parse('<script type="application/ld+json">{"a":1}</script>')),
    ).toBe(true);
  });
  it('ignores empty blocks and other scripts', () => {
    expect(
      hasJsonLd(parse('<script type="application/ld+json"> </script>')),
    ).toBe(false);
    expect(hasJsonLd(parse('<script>var a;</script>'))).toBe(false);
  });
});

describe('sameUrl', () => {
  it('matches equal, relative and fragment variants', () => {
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- test fixture
    expect(sameUrl('http://e.com/a', 'http://e.com/a')).toBe(true);
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- test fixture
    expect(sameUrl('/a', 'http://e.com/a')).toBe(true);
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- test fixture
    expect(sameUrl('http://e.com/a#x', 'http://e.com/a')).toBe(true);
  });
  it('detects differences', () => {
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- test fixture
    expect(sameUrl('http://e.com/b', 'http://e.com/a')).toBe(false);
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- test fixture
    expect(sameUrl('https://e.com/a', 'http://e.com/a')).toBe(false);
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- test fixture
    expect(sameUrl('http://e.com/a?x=1', 'http://e.com/a')).toBe(false);
  });
  it('returns false for unparsable input', () => {
    // eslint-disable-next-line sonarjs/no-clear-text-protocols, unicorn/prefer-https -- test fixture
    expect(sameUrl('http://', 'http://e.com/a')).toBe(false);
  });
});

describe('audit fixes', () => {
  it('ignores an svg title when the page has none', () => {
    expect(
      getTitle(parse('<body><svg><title>icon</title></svg></body>')),
    ).toBeNull();
  });
  it('treats an empty canonical href as absent', () => {
    expect(getCanonical(parse('<link rel="canonical" href=" ">'))).toBeNull();
  });
  it('reads googlebot and bingbot tags and expands none', () => {
    expect(
      getRobotsDirectives(
        parse(
          '<meta name="GoogleBot" content="noindex"><meta name="bingbot" content="none">',
        ),
      ),
    ).toEqual(['noindex', 'none', 'noindex', 'nofollow']);
  });
  it('reads the X-Robots-Tag header with a bot prefix', () => {
    expect(
      getRobotsHeaderDirectives({
        'X-Robots-Tag': 'googlebot: noindex, nofollow',
      }),
    ).toEqual(['noindex', 'nofollow']);
    expect(getRobotsHeaderDirectives({})).toEqual([]);
  });
  it('rejects invalid, empty and non-object JSON-LD but accepts @graph', () => {
    const ld = (x: string) =>
      hasJsonLd(parse(`<script type="application/ld+json">${x}</script>`));
    expect(ld('{not json')).toBe(false);
    expect(ld('{}')).toBe(false);
    expect(ld('"text"')).toBe(false);
    expect(ld('{"@graph":[{"@type":"WebPage"}]}')).toBe(true);
    expect(ld('[{"@type":"WebPage"}]')).toBe(true);
  });
});

describe('findRobotsSource', () => {
  it('finds the meta tag that carries the directive', () => {
    const doc = parse(
      '<meta name="robots" content="index"><meta name="googlebot" content="noindex">',
    );
    const found = findRobotsSource(doc as never, {}, 'noindex');
    expect(found).toHaveProperty('element');
  });
  it('falls back to the X-Robots-Tag header', () => {
    expect(
      findRobotsSource(
        parse('') as never,
        { 'x-robots-tag': 'noindex' },
        'noindex',
      ),
    ).toEqual({ header: { name: 'X-Robots-Tag', value: 'noindex' } });
  });
  it('returns null when nothing carries it', () => {
    expect(
      findRobotsSource(
        parse('') as never,
        { 'x-robots-tag': 'noarchive' },
        'noindex',
      ),
    ).toBeNull();
  });
});
