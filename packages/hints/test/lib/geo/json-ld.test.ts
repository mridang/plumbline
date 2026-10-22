import { describe, expect, it } from '@jest/globals';
import {
  containsSpeakable,
  containsType,
  findEntityNode,
  hasNonEmptySameAs,
  readJsonLd,
} from '../../../src/lib/geo/json-ld.js';

const doc = (...texts: string[]) => ({
  querySelectorAll: () => texts.map((textContent) => ({ textContent })),
});

describe('readJsonLd', () => {
  it('parses valid blocks and counts invalid ones', () => {
    const result = readJsonLd(doc('{"a":1}', '{oops', ''));
    expect(result).toEqual({
      total: 3,
      invalid: 2,
      parsed: [{ a: 1 }],
      parsedAt: [0],
      invalidAt: [1, 2],
    });
  });

  it('handles no blocks', () => {
    expect(readJsonLd(doc())).toEqual({
      total: 0,
      invalid: 0,
      parsed: [],
      parsedAt: [],
      invalidAt: [],
    });
  });
});

describe('containsType', () => {
  it('matches a string type, an array type, an array and a @graph', () => {
    expect(containsType({ '@type': 'FAQPage' }, 'FAQPage')).toBe(true);
    expect(containsType({ '@type': ['Thing', 'FAQPage'] }, 'FAQPage')).toBe(
      true,
    );
    expect(
      containsType([{ '@type': 'X' }, { '@type': 'FAQPage' }], 'FAQPage'),
    ).toBe(true);
    expect(
      containsType({ '@graph': [{ '@type': 'FAQPage' }] }, 'FAQPage'),
    ).toBe(true);
  });

  it('rejects other types and non-objects', () => {
    expect(containsType({ '@type': 'WebPage' }, 'FAQPage')).toBe(false);
    expect(containsType({ '@graph': [{ '@type': 'X' }] }, 'FAQPage')).toBe(
      false,
    );
    expect(containsType('FAQPage', 'FAQPage')).toBe(false);
    expect(containsType(null, 'FAQPage')).toBe(false);
  });
});

describe('containsSpeakable', () => {
  it('matches the type, the property and a @graph', () => {
    expect(containsSpeakable({ '@type': 'SpeakableSpecification' })).toBe(true);
    expect(containsSpeakable({ '@type': ['SpeakableSpecification'] })).toBe(
      true,
    );
    expect(containsSpeakable({ speakable: { cssSelector: ['h1'] } })).toBe(
      true,
    );
    expect(containsSpeakable([{ '@graph': [{ speakable: 'x' }] }])).toBe(true);
  });

  it('rejects absent or falsy speakable', () => {
    expect(containsSpeakable({ speakable: '' })).toBe(false);
    expect(containsSpeakable({ '@graph': [{ '@type': 'WebPage' }] })).toBe(
      false,
    );
    expect(containsSpeakable(42)).toBe(false);
  });
});

describe('findEntityNode', () => {
  it('finds each entity type, in arrays and graphs', () => {
    for (const type of [
      'Organization',
      'Corporation',
      'LocalBusiness',
      'Person',
    ]) {
      expect(findEntityNode({ '@type': type })).toEqual({ '@type': type });
    }
    expect(findEntityNode({ '@type': ['Thing', 'Person'] })).not.toBeNull();
    expect(findEntityNode([{ '@type': 'X' }, { '@type': 'Person' }])).toEqual({
      '@type': 'Person',
    });
    expect(findEntityNode({ '@graph': [{ '@type': 'Organization' }] })).toEqual(
      { '@type': 'Organization' },
    );
  });

  it('returns null when there is none', () => {
    expect(findEntityNode({ '@type': 'WebPage' })).toBeNull();
    expect(findEntityNode({ '@type': [1, 2] })).toBeNull();
    expect(findEntityNode([{ '@type': 'X' }])).toBeNull();
    expect(findEntityNode('Person')).toBeNull();
  });
});

describe('hasNonEmptySameAs', () => {
  it('accepts a non-empty array or string', () => {
    expect(hasNonEmptySameAs({ sameAs: ['https://x.example'] })).toBe(true);
    expect(hasNonEmptySameAs({ sameAs: 'https://x.example' })).toBe(true);
  });

  it('rejects missing, empty, blank and other values', () => {
    expect(hasNonEmptySameAs({})).toBe(false);
    expect(hasNonEmptySameAs({ sameAs: [] })).toBe(false);
    expect(hasNonEmptySameAs({ sameAs: '  ' })).toBe(false);
    expect(hasNonEmptySameAs({ sameAs: 5 })).toBe(false);
  });
});
