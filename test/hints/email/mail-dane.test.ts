import { X509Certificate, createHash } from 'node:crypto';
import { describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-dane.js';
import type { MailNetClient } from '../../../src/lib/email/net.js';
import type { StarttlsProbe } from '../../../src/lib/email/smtp.js';
import {
  fakeDns,
  runMailHint,
  type FakeAnswer,
} from '../../lib/email/fakes.js';
import { TEST_CERT } from '../../lib/email/test-cert.js';

const cert = new X509Certificate(TEST_CERT);
const digest = (selector: 0 | 1): string =>
  createHash('sha256')
    .update(
      selector === 0
        ? cert.raw
        : cert.publicKey.export({ type: 'spki', format: 'der' }),
    )
    .digest('hex');

const TLSA = '_25._tcp.mx.example.test TLSA';

const run = (tlsa: FakeAnswer, probe: Partial<StarttlsProbe> = {}) => {
  const net: MailNetClient = {
    tcpReachable: () => Promise.resolve(true),
    probeStarttls: () =>
      Promise.resolve({
        reachable: true,
        starttls: true,
        tlsVersion: 'TLSv1.3',
        trusted: false,
        trustError: null,
        hostnameMatches: true,
        certificates: [cert.raw],
        error: null,
        ...probe,
      }),
  };
  return runMailHint(hint, {
    dns: fakeDns({ 'example.test MX': ['10 mx.example.test.'], [TLSA]: tlsa }),
    net,
  });
};

describe('mail-dane', () => {
  it('passes a signed TLSA record that matches the certificate', async () => {
    expect(
      await run({ authenticated: true, data: [`3 1 1 ${digest(1)}`] }),
    ).toEqual([]);
  });

  it('accepts a match on any one of several records', async () => {
    expect(
      await run({
        authenticated: true,
        data: [`3 1 1 ${'00'.repeat(32)}`, `3 0 1 ${digest(0)}`],
      }),
    ).toEqual([]);
  });

  it('accepts the generic record format', async () => {
    const hex = `030101${digest(1)}`;
    expect(
      await run({
        authenticated: true,
        data: [`\\# ${hex.length / 2} ${hex}`],
      }),
    ).toEqual([]);
  });

  it('reports a mail server without a TLSA record', async () => {
    const problems = await run({ authenticated: true, data: [] });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('does *not* provide a TLSA record');
    expect(problems[0].severity).toBe(Severity.error);
  });

  it('reports a TLSA record that is not DNSSEC signed', async () => {
    const problems = await run({ data: [`3 1 1 ${digest(1)}`] });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('does *not* provide a TLSA record');
  });

  it('ignores PKIX usages', async () => {
    const problems = await run({
      authenticated: true,
      data: [`1 1 1 ${digest(1)}`, `0 1 1 ${digest(1)}`],
    });
    expect(problems.map((p) => p.message)).toEqual([
      expect.stringContaining('does *not* provide a TLSA record'),
    ]);
  });

  it('reports a failed answer as missing DNSSEC proof', async () => {
    const problems = await run({ status: 2 });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('does *not* provide DNSSEC proof');
  });

  it('reports fingerprints that do not match the certificate', async () => {
    const problems = await run({
      authenticated: true,
      data: [`3 1 1 ${'00'.repeat(32)}`],
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain(
      'does *not* have any valid DANE fingerprints',
    );
  });

  it('reports malformed TLSA data as not matching', async () => {
    const problems = await run({ authenticated: true, data: ['3 1 1 abcd'] });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('valid DANE fingerprints');
  });

  it('gives a hint when the certificate cannot be retrieved', async () => {
    const problems = await run(
      { authenticated: true, data: [`3 1 1 ${digest(1)}`] },
      {
        reachable: false,
        starttls: false,
        certificates: [],
        error: 'timed out',
      },
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain('not checked');
  });

  it('is silent without MX records', async () => {
    expect(await runMailHint(hint, { dns: fakeDns({}) })).toEqual([]);
  });
});
