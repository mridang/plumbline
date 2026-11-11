import { describe, expect, it } from '@jest/globals';
import {
  isIpAddress,
  isSameParty,
  normalizeHost,
  registrableDomain,
} from '../../../src/lib/privacy/registrable-domain.js';
import { vector } from '../../helpers/data.js';

describe('registrableDomain', () => {
  it.each([
    ['example.com', 'example.com'],
    ['www.example.com', 'example.com'],
    ['a.b.c.example.com', 'example.com'],
    ['WWW.Example.COM.', 'example.com'],
    ['example.co.uk', 'example.co.uk'],
    ['www.example.co.uk', 'example.co.uk'],
    ['shop.example.com.au', 'example.com.au'],
    ['example.se', 'example.se'],
    ['www.example.se', 'example.se'],
    ['user.github.io', 'user.github.io'],
    ['cdn.user.github.io', 'user.github.io'],
    ['localhost', 'localhost'],
    ['com', 'com'],
    ['127.0.0.1', '127.0.0.1'],
    ['[::1]', '::1'],
    ['bucket.s3.amazonaws.com', 'bucket.s3.amazonaws.com'],
    ['a.bucket.s3.amazonaws.com', 'bucket.s3.amazonaws.com'],
    ['s3.amazonaws.com', 's3.amazonaws.com'],
    ['github.io', 'github.io'],
    ['co.uk', 'co.uk'],
    ['www.bar.me.uk', 'bar.me.uk'],
    ['xn--bcher-kva.example', 'xn--bcher-kva.example'],
    ['www.xn--bcher-kva.example', 'xn--bcher-kva.example'],
    ['www.bücher.example', 'xn--bcher-kva.example'],
  ])('%s -> %s', (host, expected) => {
    expect(registrableDomain(host)).toBe(expected);
  });
});

describe('isSameParty', () => {
  it('matches subdomains of one registrable domain', () => {
    expect(isSameParty('cdn.example.com', 'www.example.com')).toBe(true);
  });
  it('separates different registrable domains', () => {
    expect(isSameParty('example.com', 'example.org')).toBe(false);
    expect(isSameParty('a.co.uk', 'b.co.uk')).toBe(false);
  });
  it('separates distinct IP addresses and localhost', () => {
    expect(isSameParty('127.0.0.1', 'localhost')).toBe(false);
  });
});

describe('isIpAddress and normalizeHost', () => {
  it('recognises IPv4 and IPv6', () => {
    expect(isIpAddress(vector('ip10_0_0_1'))).toBe(true);
    expect(isIpAddress('[2001:db8::1]')).toBe(true);
    expect(isIpAddress('example.com')).toBe(false);
  });
  it('normalizes case, dots and brackets', () => {
    expect(normalizeHost(' .Example.COM. ')).toBe('example.com');
    expect(normalizeHost('example.com...')).toBe('example.com');
    expect(normalizeHost('...')).toBe('');
    expect(normalizeHost('a.' + '.'.repeat(200_000) + 'b')).toBe(
      'a.' + '.'.repeat(200_000) + 'b',
    );
    expect(normalizeHost('example.com' + '.'.repeat(200_000))).toBe(
      'example.com',
    );
  });
});
