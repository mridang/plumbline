import { describe, expect, it } from '@jest/globals';
import {
  charLength,
  hasKeywordStuffing,
  normalizeText,
  startsWithUrl,
} from '../../../src/lib/opengraph/text.js';

describe('charLength', () => {
  it('counts code points, not UTF-16 units', () => {
    expect(charLength('abc')).toBe(3);
    expect(charLength('a😀b')).toBe(3);
    expect(charLength('')).toBe(0);
  });
});

describe('startsWithUrl', () => {
  it('detects http and https at the start', () => {
    expect(startsWithUrl('https://a.com')).toBe(true);
    expect(startsWithUrl('  HTTP://a.com')).toBe(true);
  });
  it('ignores URLs later in the text and bare domains', () => {
    expect(startsWithUrl('see https://a.com')).toBe(false);
    expect(startsWithUrl('a.com')).toBe(false);
  });
});

describe('normalizeText', () => {
  it('trims, collapses spaces and lowercases', () => {
    expect(normalizeText('  Hello   WORLD ')).toBe('hello world');
  });
});

describe('hasKeywordStuffing', () => {
  it('flags a word repeated four times', () => {
    expect(hasKeywordStuffing('shoes shoes shoes shoes and more things')).toBe(
      true,
    );
  });
  it('flags a dominant word repeated three times', () => {
    expect(hasKeywordStuffing('cheap shoes buy shoes best shoes')).toBe(true);
  });
  it('accepts natural text', () => {
    expect(
      hasKeywordStuffing(
        'We make leather shoes by hand and ship them worldwide',
      ),
    ).toBe(false);
  });
  it('ignores stop words and short words', () => {
    expect(hasKeywordStuffing('the the the the the of of of of')).toBe(false);
  });
  it('accepts empty text', () => {
    expect(hasKeywordStuffing('')).toBe(false);
  });
});
