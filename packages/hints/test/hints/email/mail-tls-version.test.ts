import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-tls-version.js';
import { scanClosedMail, scanMail } from '../../lib/email/mail-tls.js';
import { restoreProbe } from '../../lib/tls/local-server.js';

afterEach(() => {
  restoreProbe();
});

describe('mail-tls-version', () => {
  it('belongs to the internetnl, email and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'tls']);
  });

  it('passes when only TLS 1.2 and 1.3 are accepted', async () => {
    expect(await scanMail(hint, { minVersion: 'TLSv1.2' })).toEqual([]);
  });

  it('reports insufficiently secure versions of the mail server', async () => {
    const problems = await scanMail(hint);
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toBe(
      '127.0.0.1: Your mail server supports *insufficiently* secure TLS versions: TLS 1.1, TLS 1.0.',
    );
    expect(problems[0].sourceCode).toBe('TLS 1.1\nTLS 1.0');
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
