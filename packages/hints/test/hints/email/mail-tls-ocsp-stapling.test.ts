import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-tls-ocsp-stapling.js';
import { connectWithNode, tlsProbe } from '../../../src/lib/tls/client.js';
import { scanClosedMail, scanMail } from '../../lib/email/mail-tls.js';
import { restoreProbe } from '../../lib/tls/local-server.js';

afterEach(() => {
  restoreProbe();
});

describe('mail-tls-ocsp-stapling', () => {
  it('belongs to the internetnl, email and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'tls']);
  });

  it('passes when a response is stapled', async () => {
    tlsProbe.connect = async (target, options) => ({
      ...(await connectWithNode(target, options)),
      ocspResponse: Buffer.from('stapled response'),
    });
    expect(await scanMail(hint)).toEqual([]);
  });

  it('informs about a missing staple when the certificate has an OCSP pointer', async () => {
    const problems = await scanMail(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toBe(
      '127.0.0.1: Your mail server does *not* support OCSP stapling, although your mail server certificate has an OCSP pointer.',
    );
    expect(problems[0].sourceCode).toContain('OCSP - URI: ');
    expect(problems[0].sourceCode).toContain('Stapled OCSP response: none');
  });

  it('does not apply to a certificate without an OCSP pointer', async () => {
    expect(await scanMail(hint, { cert: 'rsa3072-noocsp' })).toEqual([]);
  });

  it('says so when the mail server cannot be reached', async () => {
    const { problems, port } = await scanClosedMail(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toBe(
      `127.0.0.1: Could not test: no TLS connection to 127.0.0.1:${port}.`,
    );
    expect(problems[0].sourceCode).toBe(`127.0.0.1:${port}`);
  });
});
