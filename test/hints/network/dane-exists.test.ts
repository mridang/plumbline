import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/dane-exists.js';
import { installDns, type Zone } from '../../lib/network/fake-dns.js';
import { runHint } from '../../helpers/run-hint.js';
import { Severity } from '@hint/utils-types';

let restore: () => void = () => undefined;
afterEach(() => restore());
const run = (zone: Zone) => {
  restore = installDns(zone);
  return runHint(hint);
};
const name = '_443._tcp.example.test';

describe('dane-exists', () => {
  it('passes with a secured TLSA record', async () => {
    expect(
      await run({ [name]: { TLSA: { data: ['3 1 1 ab'], ad: true } } }),
    ).toEqual([]);
  });

  it('gives information when there is no TLSA record', async () => {
    const problems = await run({});
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('does not contain a TLSA record');
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('reports a failed DNSSEC proof as an error', async () => {
    const problems = await run({ [name]: { TLSA: { status: 2 } } });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('DNSSEC proof');
    expect(problems[0].severity).toBe(Severity.error);
  });
});
