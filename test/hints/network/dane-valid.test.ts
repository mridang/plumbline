import { afterEach, describe, expect, it } from '@jest/globals';
import hint from '../../../src/hints/network/dane-valid.js';
import { tls } from '../../../src/lib/network/dane.js';
import { installDns } from '../../lib/network/fake-dns.js';
import { runHint } from '../../helpers/run-hint.js';
import { createHash } from 'node:crypto';

const realFetch = tls.fetchChain;
let restore: () => void = () => undefined;
afterEach(() => {
  restore();
  tls.fetchChain = realFetch;
});
const certificate = Buffer.from('not a real certificate');
const leafHash = createHash('sha256').update(certificate).digest('hex');
const zone = (data: string) => ({
  '_443._tcp.example.test': { TLSA: { data: [data], ad: true } },
});

describe('dane-valid', () => {
  it('passes when the TLSA record matches the certificate', async () => {
    restore = installDns(zone(`3 0 1 ${leafHash}`));
    tls.fetchChain = async () => ({ chain: [certificate], pkixValid: false });
    expect(await runHint(hint)).toEqual([]);
  });

  it('reports a record that does not match', async () => {
    restore = installDns(zone(`3 0 1 ${'00'.repeat(32)}`));
    tls.fetchChain = async () => ({ chain: [certificate], pkixValid: false });
    const problems = await runHint(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('not valid for your web certificate');
  });

  it('is not tested when DANE does not exist', async () => {
    restore = installDns({});
    tls.fetchChain = async () => {
      throw new Error('must not connect');
    };
    expect(await runHint(hint)).toEqual([]);
  });

  it('is not tested when the server cannot be reached over TLS', async () => {
    restore = installDns(zone(`3 0 1 ${'00'.repeat(32)}`));
    tls.fetchChain = async () => null;
    expect(await runHint(hint)).toEqual([]);
  });
});
