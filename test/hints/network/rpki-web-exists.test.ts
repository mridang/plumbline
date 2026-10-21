import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/rpki-web-exists.js';
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
const answer = (r: RpkiResult) => {
  rpki.client = { check: async () => r };
};

describe('rpki-web-exists', () => {
  it('passes when a ROA exists', async () => {
    restore = installDns(zone);
    answer({ asn: 64500, prefix: '192.0.2.0/24', status: 'valid' });
    expect(await runHint(hint)).toEqual([]);
  });

  it('counts an invalid announcement as having a ROA', async () => {
    restore = installDns(zone);
    answer({ asn: 64500, prefix: '192.0.2.0/24', status: 'invalid' });
    expect(await runHint(hint)).toEqual([]);
  });

  it('warns when no ROA is published', async () => {
    restore = installDns(zone);
    answer({ asn: 64500, prefix: '192.0.2.0/24', status: 'unknown' });
    const problems = await runHint(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('example.test (192.0.2.9)');
  });

  it('does nothing without web server addresses', async () => {
    restore = installDns({});
    expect(await runHint(hint)).toEqual([]);
  });
});
