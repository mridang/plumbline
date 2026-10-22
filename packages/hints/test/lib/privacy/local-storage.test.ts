import { describe, expect, it } from '@jest/globals';
import {
  parseStorage,
  truncate,
} from '../../../src/lib/privacy/local-storage.js';

describe('truncate', () => {
  it('cuts long strings and keeps short ones', () => {
    expect(truncate('abc', 5)).toBe('abc');
    expect(truncate('abcdef', 3)).toBe('abc...');
    expect(truncate('x'.repeat(60))).toBe(`${'x'.repeat(50)}...`);
  });
  it('counts characters as a reader sees them, not UTF-16 units', () => {
    expect(truncate('😀'.repeat(60))).toBe(`${'😀'.repeat(50)}...`);
    expect(truncate('👨‍👩‍👧x', 1)).toBe('👨‍👩‍👧...');
    expect(truncate('😀'.repeat(50))).toBe('😀'.repeat(50));
  });
});

describe('parseStorage', () => {
  it('reads a JSON string or an object', () => {
    expect(parseStorage('{"a":"1"}')).toEqual([{ key: 'a', value: '1' }]);
    expect(parseStorage({ a: 2 })).toEqual([{ key: 'a', value: '2' }]);
  });
  it('treats unusable values as empty', () => {
    expect(parseStorage('not json')).toEqual([]);
    expect(parseStorage('[1]')).toEqual([]);
    expect(parseStorage(null)).toEqual([]);
    expect(parseStorage(undefined)).toEqual([]);
    expect(parseStorage('{}')).toEqual([]);
  });
});
