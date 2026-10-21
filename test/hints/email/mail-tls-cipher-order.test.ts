import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-tls-cipher-order.js';
import { scanClosedMail, scanMail } from '../../lib/email/mail-tls.js';
import { restoreProbe } from '../../lib/tls/local-server.js';

afterEach(() => {
  restoreProbe();
});

describe('mail-tls-cipher-order', () => {
  it('belongs to the internetnl, email and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'tls']);
  });

  it('passes when the server enforces its own, better, order', async () => {
    expect(
      await scanMail(hint, {
        maxVersion: 'TLSv1.2',
        honorCipherOrder: true,
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-SHA256',
      }),
    ).toEqual([]);
  });

  it('reports a server that follows the client order', async () => {
    const problems = await scanMail(hint, {
      maxVersion: 'TLSv1.2',
      honorCipherOrder: false,
      ciphers: 'ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES128-GCM-SHA256',
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      '127.0.0.1: Your mail server does *not* enforce its own preference',
    );
    expect(problems[0].sourceCode).toContain('Server chose: ');
    expect(problems[0].sourceCode).toContain('Should have chosen: ');
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
