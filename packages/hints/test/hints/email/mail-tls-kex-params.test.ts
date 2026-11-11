import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-tls-kex-params.js';
import { scanClosedMail, scanMail } from '../../lib/email/mail-tls.js';
import { fixture, restoreProbe } from '../../lib/tls/local-server.js';

afterEach(() => {
  restoreProbe();
});

describe('mail-tls-kex-params', () => {
  it('belongs to the internetnl, email and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'tls']);
  });

  it('passes with good curves only', async () => {
    expect(
      await scanMail(hint, { ecdhCurve: 'X25519:prime256v1:secp384r1' }),
    ).toEqual([]);
  });

  it('warns about a curve to be phased out', async () => {
    const problems = await scanMail(hint, {
      ecdhCurve: 'prime256v1:secp224r1',
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('127.0.0.1: Your mail server');
    expect(problems[0].sourceCode).toContain('ECDH-secp224r1');
  });

  it('reports finite field Diffie-Hellman with a small group', async () => {
    const problems = await scanMail(hint, {
      maxVersion: 'TLSv1.2',
      ciphers: 'DHE-RSA-AES128-GCM-SHA256',
      dhparam: await fixture('dh2048.pem'),
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain('DH-2048');
    expect(problems[0].sourceCode).toContain('DH-2048');
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
