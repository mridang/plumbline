import { describe, expect, it } from '@jest/globals';
import { registrableDomain } from '../../../src/lib/email/domain.js';

describe('registrableDomain', () => {
  it('keeps the last two labels', () => {
    expect(registrableDomain('www.shop.example.com')).toBe('example.com');
    expect(registrableDomain('example.org')).toBe('example.org');
  });

  it('is case insensitive and ignores a trailing dot', () => {
    expect(registrableDomain('WWW.Example.COM.')).toBe('example.com');
  });

  it('keeps three labels under a known multi-label suffix', () => {
    expect(registrableDomain('www.example.co.uk')).toBe('example.co.uk');
    expect(registrableDomain('example.com.au')).toBe('example.com.au');
  });

  it('returns null for a bare multi-label suffix', () => {
    expect(registrableDomain('co.uk')).toBeNull();
  });

  it('returns null for IP addresses', () => {
    expect(registrableDomain('127.0.0.1')).toBeNull();
    expect(registrableDomain('::1')).toBeNull();
    expect(registrableDomain('[::1]')).toBeNull();
  });

  it('returns null for single labels and non-public names', () => {
    expect(registrableDomain('localhost')).toBeNull();
    expect(registrableDomain('')).toBeNull();
    expect(registrableDomain('printer.local')).toBeNull();
    expect(registrableDomain('app.test')).toBeNull();
    expect(registrableDomain('a..b')).toBeNull();
  });
});
