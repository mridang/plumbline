import { describe, expect, it } from '@jest/globals';
import {
  isBareHost,
  isThirdParty,
  registrableDomain,
} from '../../../src/lib/headers/registrable-domain.js';

describe('registrableDomain', () => {
  it.each([
    ['www.example.com', 'example.com'],
    ['a.b.example.org.', 'example.org'],
    ['example.com', 'example.com'],
    ['shop.example.co.uk', 'example.co.uk'],
    ['EXAMPLE.COM', 'example.com'],
    ['127.0.0.1', '127.0.0.1'],
    ['localhost', 'localhost'],
    ['[::1]', '[::1]'],
  ])('%s -> %s', (host, expected) => {
    expect(registrableDomain(host)).toBe(expected);
  });
});

describe('isBareHost', () => {
  it('is true for IPs and dotless names only', () => {
    expect(isBareHost('127.0.0.1')).toBe(true);
    expect(isBareHost('localhost')).toBe(true);
    expect(isBareHost('example.com')).toBe(false);
  });
});

describe('isThirdParty', () => {
  it('compares registrable domains', () => {
    expect(isThirdParty('https://r.example.net/x', 'example.com')).toBe(true);
    expect(isThirdParty('https://sub.example.com/x', 'example.com')).toBe(
      false,
    );
  });

  it('never flags URLs without a host', () => {
    expect(isThirdParty('/relative', 'example.com')).toBe(false);
    expect(isThirdParty('data:text/plain,x', 'example.com')).toBe(false);
  });
});
