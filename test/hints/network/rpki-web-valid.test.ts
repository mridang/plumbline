import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/rpki-web-valid.js';
import { rpki, type RpkiResult } from '../../../src/core/rpki.js';
import { installDns } from '../../lib/network/fake-dns.js';
import { runHint } from '../../helpers/run-hint.js';

const realClient = rpki.client;
let restore: () => void = () => undefined;
afterEach(() => {
  restore();
  rpki.client = realClient;
});
const zone = {
  'example.test': { A: { data: ['192.0.2.9'] } },
};
const run = (r: RpkiResult) => {
  restore = installDns(zone);
  rpki.client = { check: async () => r };
  return runHint(hint);
};

describe('rpki-web-valid', () => {
  it('passes for a valid announcement', async () => {
    expect(
      await run({ asn: 1, prefix: '192.0.2.0/24', status: 'valid' }),
    ).toEqual([]);
  });

  it('reports an invalid announcement', async () => {
    const problems = await run({ asn: 1, prefix: 'p', status: 'invalid' });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('Invalid validation state');
    expect(problems[0].sourceCode).toMatch(/^example\.test \S+ p AS1 invalid$/);
  });

  it('reports a NotFound announcement', async () => {
    const problems = await run({ asn: 1, prefix: 'p', status: 'unknown' });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('NotFound validation state');
    expect(problems[0].sourceCode).toMatch(/^example\.test \S+ p AS1 unknown$/);
  });

  it('is not tested when nothing is routed', async () => {
    expect(await run({ asn: null, prefix: null, status: 'unknown' })).toEqual(
      [],
    );
  });
});
