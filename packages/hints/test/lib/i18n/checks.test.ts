import { createRequire } from 'node:module';
import { describe, expect, it } from '@jest/globals';
import {
  alternateMedia,
  hreflangDuplicate,
  hreflangReturn,
  hreflangSelf,
  hreflangValidCodes,
  hreflangXDefault,
  paginationRel,
} from '../../../src/lib/i18n/checks.js';
import type { DocumentLike } from '../../../src/lib/i18n/read.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line sonarjs/no-require-or-define -- @hint/utils-dom is CommonJS only, loaded through createRequire
const { createHTMLDocument } = require('@hint/utils-dom');

const parse = (head: string): DocumentLike =>
  createHTMLDocument(
    `<!doctype html><html><head>${head}</head><body></body></html>`,
    'https://x.test/',
  ) as DocumentLike;

describe('hreflangReturn', () => {
  it('passes when every alternate is an absolute URL', () => {
    expect(
      hreflangReturn(
        parse(
          '<link rel="alternate" hreflang="en" href="https://x.test/en">' +
            '<link rel="alternate" hreflang="fr" href="https://x.test/fr">',
        ),
      ),
    ).toEqual([]);
  });

  it('warns for each non-absolute alternate, in order', () => {
    const findings = hreflangReturn(
      parse(
        '<link rel="alternate" hreflang="en" href="/en">' +
          '<link rel="alternate" hreflang="fr" href="//x.test/fr">',
      ),
    );
    expect(findings).toHaveLength(2);
    expect(findings.every((f) => f.severity === 'warning')).toBe(true);
    expect(findings[0].message).toContain('"en"');
    expect(findings[1].message).toContain('"fr"');
  });

  it('ignores an empty href (no alternate to verify)', () => {
    expect(
      hreflangReturn(parse('<link rel="alternate" hreflang="en">')),
    ).toEqual([]);
  });
});

describe('hreflangXDefault', () => {
  it('is silent when there are no hreflang alternates', () => {
    expect(hreflangXDefault(parse(''))).toEqual([]);
  });

  it('passes when an x-default is present (any case)', () => {
    expect(
      hreflangXDefault(
        parse(
          '<link rel="alternate" hreflang="en" href="https://x.test/">' +
            '<link rel="alternate" hreflang="X-Default" href="https://x.test/">',
        ),
      ),
    ).toEqual([]);
  });

  it('hints when alternates exist but none is x-default', () => {
    const [found] = hreflangXDefault(
      parse('<link rel="alternate" hreflang="en" href="https://x.test/">'),
    );
    expect(found.severity).toBe('hint');
    expect(found.message).toContain('x-default');
  });
});

describe('hreflangValidCodes', () => {
  it('passes when every value is valid', () => {
    expect(
      hreflangValidCodes(
        parse(
          '<link rel="alternate" hreflang="en-US" href="https://x.test/">' +
            '<link rel="alternate" hreflang="x-default" href="https://x.test/">',
        ),
      ),
    ).toEqual([]);
  });

  it('warns for each invalid code, in order', () => {
    const findings = hreflangValidCodes(
      parse(
        '<link rel="alternate" hreflang="en_US" href="https://x.test/">' +
          '<link rel="alternate" hreflang="english" href="https://x.test/">',
      ),
    );
    expect(findings.map((f) => f.severity)).toEqual(['warning', 'warning']);
    expect(findings[0].message).toContain('"en_US"');
    expect(findings[1].message).toContain('"english"');
  });
});

describe('hreflangSelf', () => {
  it('is silent without any hreflang alternates', () => {
    expect(hreflangSelf(parse(''), 'https://x.test/')).toEqual([]);
  });

  it('passes when an alternate points at the page itself', () => {
    expect(
      hreflangSelf(
        parse(
          '<link rel="alternate" hreflang="en" href="https://x.test/">' +
            '<link rel="alternate" hreflang="fr" href="https://x.test/fr">',
        ),
        'https://x.test/',
      ),
    ).toEqual([]);
  });

  it('warns when no alternate references the page', () => {
    const [found] = hreflangSelf(
      parse(
        '<link rel="alternate" hreflang="fr" href="https://x.test/fr">' +
          '<link rel="alternate" hreflang="de" href="https://x.test/de">',
      ),
      'https://x.test/',
    );
    expect(found.severity).toBe('warning');
    expect(found.message).toContain('https://x.test/');
  });
});

describe('hreflangDuplicate', () => {
  it('passes when every value is unique', () => {
    expect(
      hreflangDuplicate(
        parse(
          '<link rel="alternate" hreflang="en" href="https://x.test/en">' +
            '<link rel="alternate" hreflang="fr" href="https://x.test/fr">',
        ),
      ),
    ).toEqual([]);
  });

  it('warns once for each repeat after the first (case-insensitive)', () => {
    const findings = hreflangDuplicate(
      parse(
        '<link rel="alternate" hreflang="en" href="https://x.test/en">' +
          '<link rel="alternate" hreflang="EN" href="https://x.test/en2">' +
          '<link rel="alternate" hreflang="en" href="https://x.test/en3">',
      ),
    );
    expect(findings).toHaveLength(2);
    expect(findings[0].severity).toBe('warning');
  });
});

describe('alternateMedia', () => {
  it('passes a well-formed media alternate', () => {
    expect(
      alternateMedia(
        parse(
          '<link rel="alternate" media="only screen and (max-width: 640px)" href="https://m.x.test/">',
        ),
      ),
    ).toEqual([]);
  });

  it('warns when the media query is empty', () => {
    const [found] = alternateMedia(
      parse('<link rel="alternate" media="" href="https://m.x.test/">'),
    );
    expect(found.severity).toBe('warning');
  });

  it('warns when the href is not absolute', () => {
    const [found] = alternateMedia(
      parse('<link rel="alternate" media="print" href="/print">'),
    );
    expect(found.severity).toBe('warning');
  });
});

describe('paginationRel', () => {
  it('passes well-formed prev/next links', () => {
    expect(
      paginationRel(
        parse(
          '<link rel="prev" href="https://x.test/1">' +
            '<link rel="next" href="https://x.test/3">',
        ),
      ),
    ).toEqual([]);
  });

  it('warns for a non-absolute next and a blank prev', () => {
    const findings = paginationRel(
      parse('<link rel="prev" href="">' + '<link rel="next" href="/3">'),
    );
    expect(findings).toHaveLength(2);
    expect(findings.map((f) => f.severity)).toEqual(['warning', 'warning']);
  });
});
