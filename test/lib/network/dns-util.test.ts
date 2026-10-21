import { afterEach, describe, expect, it } from '@jest/globals';
import {
  findNameservers,
  ipv4Addresses,
  ipv6Addresses,
  normalizeName,
  safeQuery,
  siteHost,
  target,
} from '../../../src/lib/network/dns-util.js';
import { dns } from '../../../src/core/dns.js';
import { installDns } from './fake-dns.js';

let restore: () => void = () => undefined;
afterEach(() => restore());

describe('dns-util', () => {
  it('normalizes names', () => {
    expect(normalizeName('WWW.Example.ORG.')).toBe('www.example.org');
  });

  it('returns the host of a URL and null for IP literals', () => {
    expect(siteHost(new URL('https://Example.org./x'))).toBe('example.org');
    expect(siteHost(new URL('http://127.0.0.1:3000/'))).toBeNull();
    expect(siteHost(new URL('http://[::1]/'))).toBeNull();
  });

  it('uses the configured host mapping', () => {
    const real = target.hostOf;
    target.hostOf = () => 'mapped.test';
    try {
      expect(siteHost(new URL('http://127.0.0.1/'))).toBe('mapped.test');
    } finally {
      target.hostOf = real;
    }
  });

  it('returns null when the resolver throws', async () => {
    const real = dns.client;
    dns.client = {
      query: () => Promise.reject(new Error('down')),
    };
    try {
      expect(await safeQuery('a.test', 'A')).toBeNull();
    } finally {
      dns.client = real;
    }
  });

  it('drops IPv4-mapped and invalid AAAA answers', async () => {
    restore = installDns({
      'a.test': {
        AAAA: { data: ['2001:db8::1', '::ffff:192.0.2.1', 'nonsense'] },
        A: { data: ['192.0.2.7'] },
      },
    });
    expect(await ipv6Addresses('a.test')).toEqual(['2001:db8::1']);
    expect(await ipv4Addresses('a.test')).toEqual(['192.0.2.7']);
  });

  it('walks up the labels until NS records answer', async () => {
    restore = installDns({
      'example.org': { NS: { data: ['ns1.example.net.', 'NS2.example.net.'] } },
    });
    expect(await findNameservers('www.shop.example.org')).toEqual({
      zone: 'example.org',
      nameservers: ['ns1.example.net', 'ns2.example.net'],
    });
  });

  it('never queries the TLD and returns no servers when nothing answers', async () => {
    restore = installDns({ org: { NS: { data: ['a.root.'] } } });
    expect(await findNameservers('www.example.org')).toEqual({
      zone: 'www.example.org',
      nameservers: [],
    });
  });
});
