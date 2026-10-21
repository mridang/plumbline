import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-cert-signature.js';
import { scanClosedMail, scanMail } from '../../lib/email/mail-tls.js';
import { restoreProbe } from '../../lib/tls/local-server.js';

afterEach(() => {
  restoreProbe();
});

describe('mail-cert-signature', () => {
  it('belongs to the internetnl, email and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'tls']);
  });

  it('passes for a SHA-256 signature', async () => {
    expect(await scanMail(hint, { cert: 'rsa3072' })).toEqual([]);
  });

  it('warns about SHA-224', async () => {
    const problems = await scanMail(hint, { cert: 'rsa3072-sha224' });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain(
      '127.0.0.1: Your mail server certificate is signed using a signing algorithm',
    );
    expect(problems[0].sourceCode).toContain(
      'Signature algorithm: ecdsa-with-SHA224',
    );
  });

  it('reports SHA-1', async () => {
    const problems = await scanMail(hint, { cert: 'rsa3072-sha1' });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain('localhost: ecdsa-with-SHA1');
    expect(problems[0].sourceCode).toContain(
      'Signature algorithm: ecdsa-with-SHA1',
    );
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
