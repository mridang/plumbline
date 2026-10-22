import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-cert-pubkey.js';
import { scanClosedMail, scanMail } from '../../lib/email/mail-tls.js';
import { restoreProbe } from '../../lib/tls/local-server.js';

afterEach(() => {
  restoreProbe();
});

describe('mail-cert-pubkey', () => {
  it('belongs to the internetnl, email and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'tls']);
  });

  it.each(['rsa3072', 'ec256', 'ed25519'])('passes for %s', async (cert) => {
    expect(await scanMail(hint, { cert })).toEqual([]);
  });

  it('warns about a key to be phased out', async () => {
    const problems = await scanMail(hint, { cert: 'rsa2048' });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain(
      '127.0.0.1: The public key of your mail server certificate',
    );
    expect(problems[0].message).toContain('localhost: RSA-2048');
    expect(problems[0].sourceCode).toContain('Public key: RSA-2048');
  });

  it('reports an insufficient key', async () => {
    const problems = await scanMail(hint, { cert: 'rsa1024' });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      '*not* based on a secure signing algorithm',
    );
    expect(problems[0].sourceCode).toContain('Subject: CN=localhost');
    expect(problems[0].sourceCode).toContain('Public key: RSA-1024');
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
