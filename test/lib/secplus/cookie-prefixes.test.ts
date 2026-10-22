import { describe, expect, it } from '@jest/globals';
import {
  cookiePrefixFindings,
  parsePrefixCookie,
} from '../../../src/lib/secplus/cookie-prefixes.js';

describe('parsePrefixCookie', () => {
  it('reads the name, Secure, Path and Domain', () => {
    const cookie = parsePrefixCookie(
      '__Host-id=abc; Secure; Path=/; Domain=example.test',
    );
    expect(cookie).toEqual({
      name: '__Host-id',
      secure: true,
      path: '/',
      domain: 'example.test',
    });
  });

  it('returns null for a value with no name', () => {
    expect(parsePrefixCookie('=abc; Secure')).toBeNull();
  });
});

describe('cookiePrefixFindings', () => {
  it('accepts a correct __Host- cookie', () => {
    expect(cookiePrefixFindings(['__Host-id=abc; Secure; Path=/'])).toEqual([]);
  });

  it('flags a __Host- cookie without Secure', () => {
    const [found] = cookiePrefixFindings(['__Host-id=abc; Path=/']);
    expect(found?.severity).toBe('error');
    expect(found?.message).toContain('not Secure');
  });

  it('flags a __Host- cookie with a non-root Path', () => {
    const [found] = cookiePrefixFindings(['__Host-id=abc; Secure; Path=/app']);
    expect(found?.message).toContain("Path is not '/'");
  });

  it('flags a __Host- cookie that sets Domain', () => {
    const [found] = cookiePrefixFindings([
      '__Host-id=abc; Secure; Path=/; Domain=example.test',
    ]);
    expect(found?.message).toContain('Domain');
  });

  it('accepts a correct __Secure- cookie', () => {
    expect(cookiePrefixFindings(['__Secure-id=abc; Secure'])).toEqual([]);
  });

  it('flags a __Secure- cookie without Secure', () => {
    const [found] = cookiePrefixFindings(['__Secure-id=abc; Path=/']);
    expect(found?.severity).toBe('error');
    expect(found?.message).toContain('not Secure');
  });

  it('matches the prefix case-insensitively', () => {
    const [found] = cookiePrefixFindings(['__host-id=abc; Path=/']);
    expect(found?.severity).toBe('error');
  });

  it('ignores a cookie with no special prefix', () => {
    expect(cookiePrefixFindings(['session=abc'])).toEqual([]);
  });

  it('reports every attribute problem of one __Host- cookie in one finding', () => {
    const found = cookiePrefixFindings([
      '__Host-id=abc; Domain=example.test; Path=/app',
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]?.message).toContain('not Secure');
    expect(found[0]?.message).toContain('Domain');
  });
});
