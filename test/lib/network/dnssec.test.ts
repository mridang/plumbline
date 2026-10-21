import { afterEach, describe, expect, it } from '@jest/globals';
import { dns } from '../../../src/core/dns.js';
import { dnssecState } from '../../../src/lib/network/dnssec.js';
import { installDns } from './fake-dns.js';

let restore: () => void = () => undefined;
afterEach(() => restore());

describe('dnssecState', () => {
  it('is secure when the resolver authenticated the SOA', async () => {
    restore = installDns({
      'example.test': { SOA: { data: ['ns. h. 1 2 3 4 5'], ad: true } },
    });
    expect(await dnssecState('example.test')).toBe('secure');
  });

  it('is insecure without AD and without DS', async () => {
    restore = installDns({
      'example.test': { SOA: { data: ['ns. h. 1 2 3 4 5'] } },
    });
    expect(await dnssecState('example.test')).toBe('insecure');
  });

  it('is bogus when a DS exists but the answer is not authenticated', async () => {
    restore = installDns({
      'example.test': {
        SOA: { data: ['ns. h. 1 2 3 4 5'] },
        NS: { data: ['ns.example.net.'] },
        DS: { data: ['1 13 2 abcd'] },
      },
    });
    expect(await dnssecState('www.example.test')).toBe('bogus');
  });

  it('is servfail on SERVFAIL', async () => {
    restore = installDns({ 'example.test': { SOA: { status: 2 } } });
    expect(await dnssecState('example.test')).toBe('servfail');
  });

  it('is error when the lookup throws', async () => {
    restore = installDns({});
    dns.client = { query: () => Promise.reject(new Error('down')) };
    expect(await dnssecState('example.test')).toBe('error');
  });
});
