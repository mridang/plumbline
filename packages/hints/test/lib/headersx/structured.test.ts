import { describe, expect, it } from '@jest/globals';
import {
  dictionary,
  tokenList,
  topLevelMembers,
} from '../../../src/lib/headersx/structured.js';

describe('topLevelMembers', () => {
  it('splits on top-level commas', () => {
    expect(topLevelMembers('a=1, b=2')).toEqual(['a=1', 'b=2']);
  });

  it('ignores commas inside quotes and byte sequences', () => {
    expect(topLevelMembers('a="x,y", b=:AB,CD:')).toEqual([
      'a="x,y"',
      'b=:AB,CD:',
    ]);
  });

  it('returns null for an empty value', () => {
    expect(topLevelMembers(' '.repeat(3))).toBeNull();
  });
});

describe('dictionary', () => {
  it('parses key=value members, lower-casing keys', () => {
    expect(dictionary('Sha-256=:AA:, id="x"')).toEqual([
      { key: 'sha-256', value: ':AA:' },
      { key: 'id', value: '"x"' },
    ]);
  });

  it('treats a bare key as an empty value', () => {
    expect(dictionary('key-order')).toEqual([{ key: 'key-order', value: '' }]);
  });

  it('returns null for a malformed key', () => {
    expect(dictionary('=value')).toBeNull();
    expect(dictionary('a b=1')).toBeNull();
  });

  it('returns null for an empty value', () => {
    expect(dictionary('')).toBeNull();
  });
});

describe('tokenList', () => {
  it('returns the trimmed tokens', () => {
    expect(tokenList('a, b , c')).toEqual(['a', 'b', 'c']);
  });

  it('returns null when a member is not a token', () => {
    expect(tokenList('a, "b"')).toBeNull();
  });
});
