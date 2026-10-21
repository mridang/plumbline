import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-tls-kex-hash.js';
import { scanClosedMail, scanMail } from '../../lib/email/mail-tls.js';
import { restoreProbe } from '../../lib/tls/local-server.js';

afterEach(() => {
  restoreProbe();
});

describe('mail-tls-kex-hash', () => {
  it('belongs to the internetnl, email and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'tls']);
  });

  it('passes when the server will not sign with a weak hash', async () => {
    expect(
      await scanMail(hint, {
        maxVersion: 'TLSv1.2',
        ciphers: 'DEFAULT',
        sigalgs: 'RSA+SHA256',
      }),
    ).toEqual([]);
  });

  it('reports a server that signs the key exchange with SHA-1', async () => {
    const problems = await scanMail(hint, { maxVersion: 'TLSv1.2' });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      '127.0.0.1: Your mail server supports one or more *insufficiently* secure hash functions',
    );
    expect(problems[0].sourceCode).toContain(
      'accepts only: RSA+SHA1, ECDSA+SHA1',
    );
  });

  it('warns about a server that signs with SHA-224', async () => {
    const problems = await scanMail(hint, {
      maxVersion: 'TLSv1.2',
      ciphers: 'DEFAULT',
      sigalgs: 'RSA+SHA224:RSA+SHA256',
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].sourceCode).toContain(
      'accepts only: RSA+SHA224, ECDSA+SHA224',
    );
  });

  it('does not apply to a TLS 1.3 only server', async () => {
    expect(await scanMail(hint, { minVersion: 'TLSv1.3' })).toEqual([]);
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
