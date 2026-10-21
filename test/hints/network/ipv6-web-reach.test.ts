import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/ipv6-web-reach.js';
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
  'example.test': { AAAA: { data: ['2001:db8::1', '2001:db8::2'] } },
};

describe('ipv6-web-reach', () => {
  it('passes when all addresses answer', async () => {
    restore = installDns(zone);
    network.connect = async () => true;
    expect(await runHint(hint)).toEqual([]);
  });

  it('reports an address that answers on neither port', async () => {
    restore = installDns(zone);
    network.connect = async (ip) => ip === '2001:db8::1';
    const problems = await runHint(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('2001:db8::2');
  });

  it('does nothing without IPv6 addresses', async () => {
    restore = installDns({});
    network.connect = async () => false;
    expect(await runHint(hint)).toEqual([]);
  });
});
