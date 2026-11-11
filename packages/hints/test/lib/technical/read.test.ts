import { describe, expect, it } from '@jest/globals';
import { createHTMLDocument } from '@hint/utils-dom';
import {
  altCoverage,
  canonicalHref,
  firstSkippedLevel,
  formatKb,
  headingLevels,
  imageUrls,
  imageWeightLevel,
  resolvesAsUrl,
  mapWithConcurrency,
  redirectVerdict,
  robotsAdvanced,
  twitterCardType,
} from '../../../src/lib/technical/read.js';

const doc = (body: string, head = '') =>
  createHTMLDocument(
    `<!doctype html><html><head>${head}</head><body>${body}</body></html>`,
    // eslint-disable-next-line unicorn/prefer-https -- test fixture
    'http://x.test/',
  );

describe('headings', () => {
  it('reads levels in order', () => {
    expect(headingLevels(doc('<h1>a</h1><h3>b</h3><h2>c</h2>'))).toEqual([
      1, 3, 2,
    ]);
  });
  it('finds a skipped level', () => {
    expect(firstSkippedLevel([1, 2, 4])).toEqual({ from: 2, to: 4, index: 2 });
  });
  it('accepts going back up and one step down', () => {
    expect(firstSkippedLevel([1, 2, 3, 1, 2])).toBeNull();
    expect(firstSkippedLevel([])).toBeNull();
  });
});

describe('altCoverage', () => {
  it('is null without images or without gaps', () => {
    expect(altCoverage(doc(''))).toBeNull();
    expect(
      altCoverage(doc('<img src="a" alt=""><img src="b" alt="b">')),
    ).toBeNull();
  });
  it('warns from 80% coverage', () => {
    const img = '<img src="a" alt="a">'.repeat(4) + '<img src="b">';
    expect(altCoverage(doc(img))).toEqual({
      total: 5,
      missing: 1,
      percent: 80,
      failing: false,
    });
  });
  it('fails below 80% coverage', () => {
    const result = altCoverage(doc('<img src="a"><img src="b" alt="b">'));
    expect(result).toMatchObject({ percent: 50, failing: true });
  });
});

describe('robotsAdvanced', () => {
  it('is empty without the tag', () => {
    expect(robotsAdvanced(doc(''))).toMatchObject({ content: '' });
  });
  it('splits present and missing directives', () => {
    const r = robotsAdvanced(
      doc('', '<meta name="robots" content="Max-Snippet:-1, index">'),
    );
    expect(r.present).toEqual(['max-snippet']);
    expect(r.missing).toEqual(['max-image-preview', 'max-video-preview']);
  });
});

describe('imageUrls', () => {
  it('resolves, dedupes and drops data and malformed sources', () => {
    const d = doc(
      '<img src="/a.png"><img src="/a.png"><img src="data:image/png;base64,AA"><img src="http://[bad"><img>',
    );
    // eslint-disable-next-line unicorn/prefer-https -- test fixture
    expect(imageUrls(d, 'http://x.test/p')).toEqual(['http://x.test/a.png']);
  });
});

describe('image weight', () => {
  it('classifies sizes', () => {
    expect(imageWeightLevel(200 * 1024)).toBe('ok');
    expect(imageWeightLevel(200 * 1024 + 1)).toBe('warn');
    expect(imageWeightLevel(500 * 1024)).toBe('warn');
    expect(imageWeightLevel(500 * 1024 + 1)).toBe('fail');
  });
  it('formats kilobytes', () => {
    expect(formatKb(1536)).toBe('1.5 KB');
  });
});

describe('mapWithConcurrency', () => {
  it('keeps order and respects the limit', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBe(2);
  });
  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 5, async (n) => n)).toEqual([]);
  });
});

describe('redirectVerdict', () => {
  it('is null without hops', () => {
    // eslint-disable-next-line sonarjs/no-clear-text-protocols -- test fixture
    expect(redirectVerdict([], 'http://a/', 200)).toBeNull();
  });
  it('is null for up to two hops', () => {
    expect(
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- test fixture
      redirectVerdict(['http://a/', 'http://b/'], 'http://c/', 200),
    ).toBeNull();
  });
  it('warns for more than two hops', () => {
    const v = redirectVerdict(
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- test fixture
      ['http://a/', 'http://b/', 'http://c/'],
      // eslint-disable-next-line sonarjs/no-clear-text-protocols -- test fixture
      'http://d/',
      200,
    );
    expect(v?.severity).toBe('warning');
    expect(v?.message).toContain('3 redirect hops');
  });
  it('errors when the chain ends in an error', () => {
    // eslint-disable-next-line sonarjs/no-clear-text-protocols -- test fixture
    const v = redirectVerdict(['http://a/'], 'http://b/', 404);
    expect(v?.severity).toBe('error');
    expect(v?.message).toContain('HTTP 404');
  });
});

describe('canonical and twitter readers', () => {
  it('reads the canonical href', () => {
    expect(canonicalHref(doc('', '<link rel="canonical" href=" /x ">'))).toBe(
      '/x',
    );
    expect(canonicalHref(doc(''))).toBeNull();
  });
  it('accepts absolute and relative URLs that resolve', () => {
    expect(resolvesAsUrl('https://a.test/x', 'https://b.test/')).toBe(true);
    expect(resolvesAsUrl('/x', 'https://b.test/')).toBe(true);
    expect(resolvesAsUrl('x/y', 'https://b.test/')).toBe(true);
  });
  it('rejects URLs that cannot be resolved', () => {
    expect(resolvesAsUrl('http://', 'https://b.test/')).toBe(false);
    expect(resolvesAsUrl('https://exa mple.test', 'https://b.test/')).toBe(
      false,
    );
  });
  it('reads the twitter card', () => {
    expect(
      twitterCardType(doc('', '<meta name="twitter:card" content=" app ">')),
    ).toBe('app');
    expect(
      twitterCardType(doc('', '<meta name="twitter:card" content="">')),
    ).toBeNull();
  });
});
