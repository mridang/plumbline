import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import type { DocumentLike } from '../../../src/lib/seo/read.js';
import {
  canonicalMismatch,
  canonicalMissing,
  favicon32Missing,
  faviconIcoOrPngMissing,
  faviconMissing,
  faviconSvgMissing,
  h1Missing,
  h1Multiple,
  htmlLangMissing,
  metaDescriptionMissing,
  metaDescriptionTooLong,
  metaDescriptionTooShort,
  robotsNofollow,
  robotsNoindex,
  structuredDataMissing,
  titleMissing,
  titleTooLong,
  titleTooShort,
} from '../../../src/lib/seo/checks.js';

const require = createRequire(import.meta.url);
const { createHTMLDocument } = require('@hint/utils-dom');

/** Parses markup with the same DOM implementation webhint uses. */
const parse = (html: string): DocumentLike =>
  createHTMLDocument(html, 'http://example.com/') as DocumentLike;

describe('titleMissing', () => {
  it('reports an absent or empty title as an error', () => {
    expect(titleMissing(parse('<head></head>'))[0]?.severity).toBe('error');
    expect(titleMissing(parse('<title> </title>'))[0]?.message).toContain(
      'no <title>',
    );
  });
  it('passes a present title', () => {
    expect(titleMissing(parse('<title>A real title</title>'))).toEqual([]);
  });
});

describe('titleTooLong', () => {
  it('warns over seventy characters with the length in the message', () => {
    const [found] = titleTooLong(parse(`<title>${'x'.repeat(71)}</title>`));
    expect(found?.severity).toBe('warning');
    expect(found?.message).toContain('71 characters');
  });
  it('passes a short title and an absent one', () => {
    expect(titleTooLong(parse('<title>Fine title</title>'))).toEqual([]);
    expect(titleTooLong(parse('<head></head>'))).toEqual([]);
  });
});

describe('titleTooShort', () => {
  it('flags a short title as a hint', () => {
    expect(titleTooShort(parse('<title>Short</title>'))[0]?.severity).toBe(
      'hint',
    );
  });
  it('leaves an empty or absent title to the missing check', () => {
    expect(titleTooShort(parse('<title></title>'))).toEqual([]);
    expect(titleTooShort(parse('<head></head>'))).toEqual([]);
  });
});

describe('metaDescriptionMissing', () => {
  it('reports an absent description as an error', () => {
    expect(metaDescriptionMissing(parse('<title>x</title>'))[0]?.severity).toBe(
      'error',
    );
  });
  it('passes a present one', () => {
    expect(
      metaDescriptionMissing(parse('<meta name="description" content="hi">')),
    ).toEqual([]);
  });
});

describe('metaDescriptionTooLong', () => {
  it('flags over 160 characters as a hint', () => {
    const [found] = metaDescriptionTooLong(
      parse(`<meta name="description" content="${'y'.repeat(161)}">`),
    );
    expect(found?.severity).toBe('hint');
    expect(found?.message).toContain('161 characters');
  });
  it('passes a right-sized description', () => {
    expect(
      metaDescriptionTooLong(
        parse(`<meta name="description" content="${'y'.repeat(120)}">`),
      ),
    ).toEqual([]);
  });
});

describe('metaDescriptionTooShort', () => {
  it('flags under 50 characters, including an empty description', () => {
    expect(
      metaDescriptionTooShort(
        parse('<meta name="description" content="hi">'),
      )[0]?.severity,
    ).toBe('hint');
    expect(
      metaDescriptionTooShort(parse('<meta name="description" content="">'))[0]
        ?.severity,
    ).toBe('hint');
  });
  it('passes a right-sized description and an absent one', () => {
    expect(
      metaDescriptionTooShort(
        parse(`<meta name="description" content="${'y'.repeat(80)}">`),
      ),
    ).toEqual([]);
    expect(metaDescriptionTooShort(parse('<title>x</title>'))).toEqual([]);
  });
});

describe('h1Missing', () => {
  it('warns with no h1 and passes with one', () => {
    expect(h1Missing(parse('<body><p>text</p></body>'))[0]?.severity).toBe(
      'warning',
    );
    expect(h1Missing(parse('<body><h1>Topic</h1></body>'))).toEqual([]);
  });
});

describe('h1Multiple', () => {
  it('flags more than one h1 with the count', () => {
    const [found] = h1Multiple(parse('<h1>a</h1><h1>b</h1>'));
    expect(found?.severity).toBe('hint');
    expect(found?.message).toContain('2 <h1>');
  });
  it('passes zero or one h1', () => {
    expect(h1Multiple(parse('<h1>only</h1>'))).toEqual([]);
    expect(h1Multiple(parse('<p>none</p>'))).toEqual([]);
  });
});

describe('htmlLangMissing', () => {
  it('warns with no lang and passes with one', () => {
    expect(
      htmlLangMissing(parse('<html><head></head></html>'))[0]?.severity,
    ).toBe('warning');
    expect(htmlLangMissing(parse('<html lang="en"></html>'))).toEqual([]);
  });
});

describe('robotsNoindex', () => {
  it('warns on a noindex meta tag', () => {
    expect(
      robotsNoindex(parse('<meta name="robots" content="noindex">'), {})[0]
        ?.severity,
    ).toBe('warning');
  });
  it('warns on a noindex X-Robots-Tag header', () => {
    expect(
      robotsNoindex(parse(''), { 'x-robots-tag': 'noindex' })[0]?.severity,
    ).toBe('warning');
  });
  it('passes when nothing carries noindex', () => {
    expect(
      robotsNoindex(parse('<meta name="robots" content="index, follow">'), {}),
    ).toEqual([]);
  });
});

describe('robotsNofollow', () => {
  it('flags a nofollow directive as a hint', () => {
    expect(
      robotsNofollow(parse('<meta name="robots" content="nofollow">'), {})[0]
        ?.severity,
    ).toBe('hint');
  });
  it('passes when nothing carries nofollow', () => {
    expect(robotsNofollow(parse('<title>x</title>'), {})).toEqual([]);
  });
});

describe('canonicalMissing', () => {
  it('flags a page without a canonical link', () => {
    expect(canonicalMissing(parse('<head></head>'))[0]?.severity).toBe('hint');
  });
  it('passes when a canonical is declared', () => {
    expect(canonicalMissing(parse('<link rel="canonical" href="/a">'))).toEqual(
      [],
    );
  });
});

describe('canonicalMismatch', () => {
  it('flags a canonical that points elsewhere with both URLs', () => {
    const [found] = canonicalMismatch(
      parse('<link rel="canonical" href="http://example.com/other">'),
      'http://example.com/page',
    );
    expect(found?.severity).toBe('hint');
    expect(found?.message).toContain('http://example.com/other');
    expect(found?.message).toContain('http://example.com/page');
  });
  it('passes a self-referencing canonical and a missing one', () => {
    expect(
      canonicalMismatch(
        parse('<link rel="canonical" href="http://example.com/page">'),
        'http://example.com/page',
      ),
    ).toEqual([]);
    expect(canonicalMismatch(parse('<head></head>'), 'http://x/')).toEqual([]);
  });
});

describe('structuredDataMissing', () => {
  it('flags a page with no JSON-LD and passes one with it', () => {
    expect(structuredDataMissing(parse('<head></head>'))[0]?.severity).toBe(
      'hint',
    );
    expect(
      structuredDataMissing(
        parse(
          '<script type="application/ld+json">{"@type":"WebPage"}</script>',
        ),
      ),
    ).toEqual([]);
  });
});

describe('faviconMissing', () => {
  it('flags a page with no icon link and passes one with it', () => {
    expect(faviconMissing(parse('<head></head>'))[0]?.severity).toBe('hint');
    expect(
      faviconMissing(parse('<link rel="icon" href="/favicon.ico">')),
    ).toEqual([]);
  });
});

describe('faviconIcoOrPngMissing', () => {
  it('warns when only an svg icon is declared', () => {
    expect(
      faviconIcoOrPngMissing(
        parse('<link rel="icon" type="image/svg+xml" href="/f.svg">'),
      )[0]?.severity,
    ).toBe('warning');
  });
  it('passes when an ico or png icon is declared', () => {
    expect(
      faviconIcoOrPngMissing(parse('<link rel="icon" href="/favicon.ico">')),
    ).toEqual([]);
  });
});

describe('favicon32Missing', () => {
  it('flags a missing 32x32 png and passes when present', () => {
    expect(
      favicon32Missing(parse('<link rel="icon" href="/favicon.ico">'))[0]
        ?.severity,
    ).toBe('hint');
    expect(
      favicon32Missing(
        parse('<link rel="icon" type="image/png" sizes="32x32" href="/f.png">'),
      ),
    ).toEqual([]);
  });
});

describe('faviconSvgMissing', () => {
  it('flags a missing svg icon and passes when present', () => {
    expect(
      faviconSvgMissing(parse('<link rel="icon" href="/favicon.ico">'))[0]
        ?.severity,
    ).toBe('hint');
    expect(faviconSvgMissing(parse('<link rel="icon" href="/f.svg">'))).toEqual(
      [],
    );
  });
});
