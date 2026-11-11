import { describe, expect, it } from '@jest/globals';
import {
  firstHeader,
  headerValues,
  metaContents,
} from '../../../src/lib/headers/http-headers.js';

describe('headerValues', () => {
  it('finds a header case-insensitively', () => {
    expect(headerValues({ 'X-Test': 'a' }, 'x-test')).toEqual(['a']);
  });

  it('keeps repeated headers apart', () => {
    expect(
      headerValues({ 'set-cookie': ['a=1', 'b=2'] }, 'Set-Cookie'),
    ).toEqual(['a=1', 'b=2']);
  });

  it('returns nothing for a missing header or bag', () => {
    expect(headerValues({}, 'x')).toEqual([]);
    expect(headerValues(undefined, 'x')).toEqual([]);
    let value: string | undefined;
    expect(headerValues({ x: value }, 'x')).toEqual([]);
  });
});

describe('firstHeader', () => {
  it('trims the first value', () => {
    expect(firstHeader({ x: ' a ' }, 'x')).toBe('a');
  });

  it('returns null when absent', () => {
    expect(firstHeader({}, 'x')).toBeNull();
  });
});

describe('metaContents', () => {
  const metas = [
    { http: 'Referrer-Policy', content: 'origin' },
    { http: 'refresh', content: '5' },
    { http: ' referrer-policy ', content: null },
  ];
  const document = {
    querySelectorAll: () =>
      metas.map((m) => ({
        getAttribute: (n: string) => (n === 'content' ? m.content : m.http),
      })),
  };

  it('returns the contents of matching metas in order', () => {
    expect(metaContents(document, 'http-equiv', 'referrer-policy')).toEqual([
      'origin',
      '',
    ]);
  });
});
