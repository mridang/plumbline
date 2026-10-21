import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/ipv6-ns-aaaa.js';
import { installDns, type Zone } from '../../lib/network/fake-dns.js';
import { runHint } from '../../helpers/run-hint.js';

let restore: () => void = () => undefined;
afterEach(() => restore());
const run = (zone: Zone) => {
  restore = installDns(zone);
  return runHint(hint);
};
const ns = (...names: string[]) => ({ NS: { data: names } });

describe('ipv6-ns-aaaa', () => {
  it('passes with two IPv6 name servers', async () => {
    expect(
      await run({
        'example.test': ns('a.example.net.', 'b.example.net.'),
        'a.example.net': { AAAA: { data: ['2001:db8::1'] } },
        'b.example.net': { AAAA: { data: ['2001:db8::2'] } },
      }),
    ).toEqual([]);
  });

  it('reports when no name server has IPv6', async () => {
    const problems = await run({
      'example.test': ns('a.example.net.', 'b.example.net.'),
      'a.example.net': { A: { data: ['192.0.2.1'] } },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('None of the name servers');
  });

  it('reports when only one name server has IPv6', async () => {
    const problems = await run({
      'example.test': ns('a.example.net.', 'b.example.net.'),
      'a.example.net': { AAAA: { data: ['2001:db8::1'] } },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('Only one name server');
  });

  it('does nothing when no name servers are found', async () => {
    expect(await run({})).toEqual([]);
  });
});
