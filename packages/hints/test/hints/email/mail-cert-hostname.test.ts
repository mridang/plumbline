import { createHash, X509Certificate } from 'node:crypto';
import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-cert-hostname.js';
import { fakeDns } from '../../lib/email/fakes.js';
import { scanClosedMail, scanMail } from '../../lib/email/mail-tls.js';
import { fixture, restoreProbe } from '../../lib/tls/local-server.js';

afterEach(restoreProbe);

/** The records of a mail server at 127.0.0.1 that publishes the TLSA data. */
const withTlsa = (data: string[]) =>
  fakeDns({
    'example.test MX': ['10 127.0.0.1.'],
    '_25._tcp.127.0.0.1 TLSA': { authenticated: true, data },
  });

const issuerHash = createHash('sha256')
  .update(
    new X509Certificate(await fixture('ca.pem')).publicKey.export({
      type: 'spki',
      format: 'der',
    }),
  )
  .digest('hex');

describe('mail-cert-hostname', () => {
  it('belongs to the internetnl, email and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'tls']);
  });

  it('passes when the host is on the certificate', async () => {
    expect(await scanMail(hint)).toEqual([]);
  });

  it('informs about a certificate for another name', async () => {
    const problems = await scanMail(hint, { cert: 'rsa3072-othername' });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain(
      '127.0.0.1: The domain name of your mail server does *not* match the domain name on your mail server certificate',
    );
    expect(problems[0].sourceCode).toContain('Requested host: 127.0.0.1');
  });

  it('informs about a mismatch when only DANE-EE is published', async () => {
    const dns = withTlsa([`3 1 1 ${'00'.repeat(32)}`]);
    const problems = await scanMail(
      hint,
      { cert: 'rsa3072-othername' },
      true,
      dns,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
  });

  it('reports a mismatch as an error when a DANE-TA record is published', async () => {
    const dns = withTlsa([`2 1 1 ${issuerHash}`]);
    const problems = await scanMail(
      hint,
      { cert: 'rsa3072-othername' },
      true,
      dns,
    );
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain('does *not* match');
  });

  it('says so when the mail server cannot be reached', async () => {
    const { problems } = await scanClosedMail(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain('Could not test');
  });
});
