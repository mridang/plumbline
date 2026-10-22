import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/ipv6-ns-reach.js';
import { network } from '../../../src/lib/network/ipv6.js';
import { installDns } from '../../lib/network/fake-dns.js';
import { runHint } from '../../helpers/run-hint.js';

const realConnect = network.connect;
let restore: () => void = () => undefined;
afterEach(() => {
  restore();
  network.connect = realConnect;
});
const zone = {
  'example.test': { NS: { data: ['a.example.net.', 'b.example.net.'] } },
  'a.example.net': { AAAA: { data: ['2001:db8::1'] } },
  'b.example.net': { AAAA: { data: ['2001:db8::2'] } },
};

describe('ipv6-ns-reach', () => {
  it('passes when every IPv6 name server answers', async () => {
    restore = installDns(zone);
    network.connect = async () => true;
    expect(await runHint(hint)).toEqual([]);
  });

  it('reports an unreachable IPv6 name server', async () => {
    restore = installDns(zone);
    network.connect = async (ip) => ip !== '2001:db8::2';
    const problems = await runHint(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('b.example.net (2001:db8::2)');
    expect(problems[0].sourceCode).toBe(
      'b.example.net. AAAA 2001:db8::2 ; port 53 unreachable',
    );
  });

  it('does nothing without IPv6 name servers', async () => {
    restore = installDns({
      'example.test': { NS: { data: ['a.example.net.'] } },
    });
    network.connect = async () => false;
    expect(await runHint(hint)).toEqual([]);
  });
});
