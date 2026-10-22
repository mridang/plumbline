import { describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/email/mail-ipv6.js';
import type { MailNetClient } from '../../../src/lib/email/net.js';
import { fakeDns, runMailHint } from '../../lib/email/fakes.js';

const MX = {
  'example.test MX': ['10 mx1.example.test.', '20 mx2.example.test.'],
};

/** A net client whose reachable IPs are listed. */
const net = (reachable: string[]): MailNetClient => ({
  tcpReachable: (ip) => Promise.resolve(reachable.includes(ip)),
  probeStarttls: () => Promise.reject(new Error('unused')),
});

describe('mail-ipv6', () => {
  it('passes when every mail server has a reachable IPv6 address', async () => {
    const dns = fakeDns({
      ...MX,
      'mx1.example.test AAAA': ['2001:db8::1'],
      'mx2.example.test AAAA': ['2001:db8::2'],
    });
    expect(
      await runMailHint(hint, {
        dns,
        net: net(['2001:db8::1', '2001:db8::2']),
      }),
    ).toEqual([]);
  });

  it('reports mail servers without an AAAA record', async () => {
    const dns = fakeDns({ ...MX, 'mx1.example.test AAAA': ['2001:db8::1'] });
    const problems = await runMailHint(hint, {
      dns,
      net: net(['2001:db8::1']),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('does *not* have an IPv6 address');
    expect(problems[0].sourceCode).toContain('mx2.example.test');
  });

  it('does not count IPv4-mapped addresses', async () => {
    const dns = fakeDns({
      ...MX,
      'mx1.example.test AAAA': ['2001:db8::1'],
      'mx2.example.test AAAA': ['::ffff:192.0.2.1'],
    });
    const problems = await runMailHint(hint, {
      dns,
      net: net(['2001:db8::1']),
    });
    expect(problems.map((p) => p.message)).toEqual([
      expect.stringContaining('does *not* have an IPv6 address'),
    ]);
  });

  it('reports IPv6 addresses that are not reachable', async () => {
    const dns = fakeDns({
      ...MX,
      'mx1.example.test AAAA': ['2001:db8::1'],
      'mx2.example.test AAAA': ['2001:db8::2'],
    });
    const problems = await runMailHint(hint, {
      dns,
      net: net(['2001:db8::1']),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('not* reachable over IPv6');
    expect(problems[0].sourceCode).toContain('mx2.example.test 2001:db8::2');
  });

  it('skips a host whose lookup failed', async () => {
    const dns = fakeDns({
      ...MX,
      'mx1.example.test AAAA': ['2001:db8::1'],
      'mx2.example.test AAAA': { status: 2 },
    });
    expect(await runMailHint(hint, { dns, net: net(['2001:db8::1']) })).toEqual(
      [],
    );
  });

  it('is silent without MX records', async () => {
    expect(await runMailHint(hint, { dns: fakeDns({}), net: net([]) })).toEqual(
      [],
    );
  });
});
