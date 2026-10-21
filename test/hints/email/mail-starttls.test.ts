import { connect } from 'node:net';
import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-starttls.js';
import {
  createMailNetClient,
  type MailNetClient,
} from '../../../src/lib/email/net.js';
import type { StarttlsProbe } from '../../../src/lib/email/smtp.js';
import { startSmtp, type FakeSmtp } from '../../lib/email/fake-smtp.js';
import { fakeDns, runMailHint } from '../../lib/email/fakes.js';
import { TEST_CERT } from '../../lib/email/test-cert.js';

const dns = fakeDns({ 'example.test MX': ['10 mail.example.test.'] });

const GOOD: StarttlsProbe = {
  reachable: true,
  starttls: true,
  tlsVersion: 'TLSv1.3',
  trusted: true,
  trustError: null,
  hostnameMatches: true,
  certificates: [],
  error: null,
};

/** A net client whose STARTTLS probe returns `probe` for every host. */
const net = (probe: Partial<StarttlsProbe>): MailNetClient => ({
  tcpReachable: () => Promise.resolve(true),
  probeStarttls: () => Promise.resolve({ ...GOOD, ...probe }),
});

let smtp: FakeSmtp | undefined;
afterEach(async () => {
  await smtp?.close();
  smtp = undefined;
});

describe('mail-starttls', () => {
  it('passes a server with TLS 1.3 and a trusted, matching certificate', async () => {
    expect(await runMailHint(hint, { dns, net: net({}) })).toEqual([]);
  });

  it('accepts TLS 1.2', async () => {
    expect(
      await runMailHint(hint, { dns, net: net({ tlsVersion: 'TLSv1.2' }) }),
    ).toEqual([]);
  });

  it('reports a server without STARTTLS', async () => {
    const problems = await runMailHint(hint, {
      dns,
      net: net({ starttls: false, tlsVersion: null }),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toBe(
      'At least one of your mail servers does *not* offer STARTTLS.',
    );
    expect(problems[0].severity).toBe(Severity.error);
  });

  it('reports an insufficient TLS version', async () => {
    const problems = await runMailHint(hint, {
      dns,
      net: net({ tlsVersion: 'TLSv1.1' }),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain(
      '*insufficiently* secure TLS versions',
    );
    expect(problems[0].severity).toBe(Severity.error);
  });

  it('warns about an untrusted certificate chain', async () => {
    const problems = await runMailHint(hint, {
      dns,
      net: net({ trusted: false, trustError: 'DEPTH_ZERO_SELF_SIGNED_CERT' }),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('trust chain');
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('warns about a certificate for another host name', async () => {
    const problems = await runMailHint(hint, {
      dns,
      net: net({ hostnameMatches: false }),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].message).toContain('does *not* match the domain name');
    expect(problems[0].severity).toBe(Severity.warning);
  });

  it('gives a hint when the server cannot be reached', async () => {
    const problems = await runMailHint(hint, {
      dns,
      net: net({ reachable: false, starttls: false, error: 'timed out' }),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain('Could not connect');
  });

  it('passes a real local server end to end', async () => {
    smtp = await startSmtp();
    const { port } = smtp;
    const client = createMailNetClient({
      connect: () => connect({ host: '127.0.0.1', port }),
      tlsOptions: { ca: TEST_CERT },
      timeoutMs: 3000,
    });
    expect(await runMailHint(hint, { dns, net: client })).toEqual([]);
  });

  it('reports a real local server without STARTTLS', async () => {
    smtp = await startSmtp({ starttls: false });
    const { port } = smtp;
    const client = createMailNetClient({
      connect: () => connect({ host: '127.0.0.1', port }),
      timeoutMs: 3000,
    });
    const problems = await runMailHint(hint, { dns, net: client });
    expect(problems.map((p) => p.message)).toEqual([
      'At least one of your mail servers does *not* offer STARTTLS.',
    ]);
  });

  it('is silent without MX records', async () => {
    expect(await runMailHint(hint, { dns: fakeDns({}), net: net({}) })).toEqual(
      [],
    );
  });
});
