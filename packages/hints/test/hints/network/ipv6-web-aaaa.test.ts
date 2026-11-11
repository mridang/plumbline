import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/ipv6-web-aaaa.js';
import { installDns, type Zone } from '../../lib/network/fake-dns.js';
import { runHint } from '../../helpers/run-hint.js';
import { vector } from '../../helpers/data.js';

let restore: () => void = () => undefined;
afterEach(() => restore());
const run = (zone: Zone) => {
  restore = installDns(zone);
  return runHint(hint);
};

describe('ipv6-web-aaaa', () => {
  it('passes with an AAAA record', async () => {
    expect(
      await run({ 'example.test': { AAAA: { data: ['2001:db8::1'] } } }),
    ).toEqual([]);
  });

  it('reports a host with only IPv4', async () => {
    const problems = await run({
      'example.test': { A: { data: ['192.0.2.1'] } },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('None of your web servers');
    expect(problems[0].sourceCode).toContain(
      'example.test. IN AAAA <IPv6 address of the web server>',
    );
  });

  it('does not count IPv4-mapped addresses', async () => {
    const problems = await run({
      'example.test': { AAAA: { data: [vector('ip__ffff_192_0_2_1')] } },
    });
    expect(problems).toHaveLength(1);
  });
});
