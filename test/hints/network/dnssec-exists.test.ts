import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/dnssec-exists.js';
import { dns } from '../../../src/core/dns.js';
import { installDns, type Zone } from '../../lib/network/fake-dns.js';
import { runHint } from '../../helpers/run-hint.js';

let restore: () => void = () => undefined;
afterEach(() => restore());
const run = (zone: Zone) => {
  restore = installDns(zone);
  return runHint(hint);
};

describe('dnssec-exists', () => {
  it('passes for a signed domain', async () => {
    expect(
      await run({ 'example.test': { SOA: { data: ['x'], ad: true } } }),
    ).toEqual([]);
  });

  it('reports an unsigned domain', async () => {
    const problems = await run({ 'example.test': { SOA: { data: ['x'] } } });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('not DNSSEC signed');
    expect(problems[0].sourceCode).toContain('example.test. IN SOA');
    expect(problems[0].sourceCode).toContain('IN DS <key tag>');
  });

  it('reports broken name servers', async () => {
    const problems = await run({ 'example.test': { SOA: { status: 2 } } });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('SERVFAIL');
    expect(problems[0].sourceCode).toBe(
      'example.test. IN SOA ; answered SERVFAIL',
    );
  });

  it('warns when the resolver fails', async () => {
    restore = installDns({});
    dns.client = { query: () => Promise.reject(new Error('down')) };
    const problems = await runHint(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('error occurred');
    expect(problems[0].sourceCode).toContain('example.test. IN SOA');
  });

  it('does not report a bogus domain, which is signed', async () => {
    expect(
      await run({
        'example.test': {
          SOA: { data: ['x'] },
          NS: { data: ['ns.example.net.'] },
          DS: { data: ['1 13 2 ab'] },
        },
      }),
    ).toEqual([]);
  });
});
