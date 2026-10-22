import { describe, expect, it } from '@jest/globals';
import type { DnsClient } from '../../../src/core/dns.js';
import { lookupMailServers } from '../../../src/lib/email/mx.js';
import { fakeDns } from './fakes.js';

describe('lookupMailServers', () => {
  it('returns sorted, lower-cased hosts without the trailing dot', async () => {
    const client = fakeDns({
      'a.test MX': ['20 MX2.a.test.', '10 mx1.a.test.', '10 mx1.a.test.'],
    });
    expect(await lookupMailServers(client, 'a.test')).toEqual([
      'mx1.a.test',
      'mx2.a.test',
    ]);
  });

  it('returns nothing without MX records', async () => {
    expect(await lookupMailServers(fakeDns({}), 'a.test')).toEqual([]);
  });

  it('returns nothing for a Null MX', async () => {
    const client = fakeDns({ 'a.test MX': ['0 .'] });
    expect(await lookupMailServers(client, 'a.test')).toEqual([]);
  });

  it('returns nothing when a Null MX sits next to another MX', async () => {
    const client = fakeDns({ 'a.test MX': ['0 .', '10 mx.a.test.'] });
    expect(await lookupMailServers(client, 'a.test')).toEqual([]);
  });

  it('ignores localhost', async () => {
    const client = fakeDns({ 'a.test MX': ['10 localhost.', '20 mx.a.test.'] });
    expect(await lookupMailServers(client, 'a.test')).toEqual(['mx.a.test']);
  });

  it('tests at most ten servers', async () => {
    const data = Array.from(
      { length: 12 },
      (_, i) => `10 mx${String(i).padStart(2, '0')}.a.test.`,
    );
    const hosts = await lookupMailServers(
      fakeDns({ 'a.test MX': data }),
      'a.test',
    );
    expect(hosts).toHaveLength(10);
    expect(hosts[0]).toBe('mx00.a.test');
  });

  it('returns nothing when the lookup fails', async () => {
    const servfail = fakeDns({ 'a.test MX': { status: 2 } });
    expect(await lookupMailServers(servfail, 'a.test')).toEqual([]);
    const broken: DnsClient = {
      query: () => Promise.reject(new Error('down')),
    };
    expect(await lookupMailServers(broken, 'a.test')).toEqual([]);
  });
});
