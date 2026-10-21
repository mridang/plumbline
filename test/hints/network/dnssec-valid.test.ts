import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/dnssec-valid.js';
import { installDns, type Zone } from '../../lib/network/fake-dns.js';
import { runHint } from '../../helpers/run-hint.js';

let restore: () => void = () => undefined;
afterEach(() => restore());
const run = (zone: Zone) => {
  restore = installDns(zone);
  return runHint(hint);
};

describe('dnssec-valid', () => {
  it('passes for a validated domain', async () => {
    expect(
      await run({ 'example.test': { SOA: { data: ['x'], ad: true } } }),
    ).toEqual([]);
  });

  it('reports a domain whose signature does not validate', async () => {
    const problems = await run({
      'example.test': {
        SOA: { data: ['x'] },
        NS: { data: ['ns.example.net.'] },
        DS: { data: ['1 13 2 ab'] },
      },
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain("'bogus'");
    expect(problems[0].sourceCode).toContain('example.test. IN SOA');
  });

  it('leaves unsigned domains to dnssec-exists', async () => {
    expect(await run({ 'example.test': { SOA: { data: ['x'] } } })).toEqual([]);
  });

  it('leaves SERVFAIL to dnssec-exists', async () => {
    expect(await run({ 'example.test': { SOA: { status: 2 } } })).toEqual([]);
  });
});
