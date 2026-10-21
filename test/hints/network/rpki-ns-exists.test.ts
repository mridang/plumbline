import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/rpki-ns-exists.js';
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
  'example.test': { NS: { data: ['ns.example.net.'] } },
  'ns.example.net': { A: { data: ['192.0.2.9'] } },
};
const answer = (r: RpkiResult) => {
  rpki.client = { check: async () => r };
};

describe('rpki-ns-exists', () => {
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
    expect(problems[0].message).toContain('ns.example.net (192.0.2.9)');
    expect(problems[0].sourceCode).toBe(
      'ns.example.net 192.0.2.9 192.0.2.0/24 AS64500 unknown',
    );
  });

  it('does nothing without name server addresses', async () => {
    restore = installDns({});
    expect(await runHint(hint)).toEqual([]);
  });
});
