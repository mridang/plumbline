import { describe, expect, it } from '@jest/globals';

import {
  canonicalArguments,
  limitArg,
  numberArg,
  offsetArg,
  stringArg,
  stringListArg,
} from '@/lib/mcp';

describe('stringArg', () => {
  it('trims a string and gives empty for anything else', () => {
    expect(stringArg('  hi ')).toBe('hi');
    expect(stringArg(undefined)).toBe('');
    expect(stringArg(5)).toBe('');
    expect(stringArg(null)).toBe('');
  });
});

describe('stringListArg', () => {
  it('takes one value or a list, splitting commas and dropping blanks', () => {
    expect(stringListArg('a, b')).toEqual(['a', 'b']);
    expect(stringListArg(['a', ' ', 'b,c'])).toEqual(['a', 'b', 'c']);
    expect(stringListArg(undefined)).toEqual([]);
  });

  it('counts numbers as strings and ignores other kinds of value', () => {
    expect(stringListArg([5, true, null, {}, 'x'])).toEqual(['5', 'x']);
  });
});

describe('numberArg', () => {
  it('accepts numbers and numeric strings only', () => {
    expect(numberArg(5)).toBe(5);
    expect(numberArg(' 7 ')).toBe(7);
    expect(numberArg('')).toBeUndefined();
    expect(numberArg('abc')).toBeUndefined();
    expect(numberArg(Infinity)).toBeUndefined();
    expect(numberArg(null)).toBeUndefined();
  });
});

describe('limitArg', () => {
  it('defaults to 12 and keeps the limit between 1 and 50', () => {
    expect(limitArg(undefined)).toBe(12);
    expect(limitArg(0)).toBe(1);
    expect(limitArg(-4)).toBe(1);
    expect(limitArg(500)).toBe(50);
    expect(limitArg('7')).toBe(7);
  });

  it('rounds down to a whole number', () => {
    expect(limitArg(2.9)).toBe(2);
  });
});

describe('offsetArg', () => {
  it('defaults to the start and never goes below it', () => {
    expect(offsetArg(undefined)).toBe(0);
    expect(offsetArg(-5)).toBe(0);
    expect(offsetArg('abc')).toBe(0);
    expect(offsetArg(null)).toBe(0);
  });

  it('rounds down to a whole number', () => {
    expect(offsetArg(12)).toBe(12);
    expect(offsetArg('24')).toBe(24);
    expect(offsetArg(2.9)).toBe(2);
  });
});

describe('canonicalArguments', () => {
  it.each([
    ['get_domain', { host: 'example.com' }, { domain: 'example.com' }],
    [
      'get_report',
      { url: 'https://example.com/' },
      { domain: 'https://example.com/' },
    ],
    ['list_reports', { host: 'example.com' }, { domain: 'example.com' }],
    ['scan_domain', { host: 'example.com' }, { domain: 'example.com' }],
    ['add_domain', { url: 'example.com' }, { domain: 'example.com' }],
    ['remove_domain', { url: 'example.com' }, { domain: 'example.com' }],
    ['configure_checks', { checks: ['tls'] }, { enable: ['tls'] }],
  ])(
    'renames the other spelling of an argument of %s',
    (tool, args, expected) => {
      expect(canonicalArguments(tool, args)).toEqual(expected);
    },
  );

  it('keeps every other argument as it is', () => {
    expect(
      canonicalArguments('get_report', { host: 'example.com', report: 'r1' }),
    ).toEqual({ domain: 'example.com', report: 'r1' });
  });

  it('leaves both spellings alone when both are given, so the check can refuse the other one', () => {
    expect(
      canonicalArguments('get_domain', { host: 'a.com', domain: 'b.com' }),
    ).toEqual({ host: 'a.com', domain: 'b.com' });
  });

  it('does not rename an argument of a tool that has no other spelling', () => {
    expect(canonicalArguments('list_checks', { host: 'x' })).toEqual({
      host: 'x',
    });
    expect(canonicalArguments('constructor', { host: 'x' })).toEqual({
      host: 'x',
    });
  });

  it('turns a check given as one piece of text into a list of one', () => {
    expect(
      canonicalArguments('configure_checks', { enable: 'tls', disable: 'seo' }),
    ).toEqual({ enable: ['tls'], disable: ['seo'] });
  });

  it('leaves a list, and any other value, for the check to judge', () => {
    expect(canonicalArguments('configure_checks', { enable: ['a'] })).toEqual({
      enable: ['a'],
    });
    expect(canonicalArguments('configure_checks', { enable: 5 })).toEqual({
      enable: 5,
    });
    expect(canonicalArguments('list_checks', { limit: '5' })).toEqual({
      limit: '5',
    });
  });

  it('carries a key called __proto__ as an ordinary property', () => {
    const args = JSON.parse('{"__proto__": 1, "host": "x"}') as Record<
      string,
      unknown
    >;
    const result = canonicalArguments('get_domain', args);
    expect(Object.keys(result).toSorted()).toEqual(['__proto__', 'domain']);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });
});
