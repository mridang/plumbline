import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-tls-ciphers.js';
import { scanClosedMail, scanMail } from '../../lib/email/mail-tls.js';
import { restoreProbe } from '../../lib/tls/local-server.js';

afterEach(() => {
  restoreProbe();
});

describe('mail-tls-ciphers', () => {
  it('belongs to the internetnl, email and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'tls']);
  });

  it('passes with sufficient and good suites only', async () => {
    expect(
      await scanMail(hint, {
        ciphers: 'ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384',
      }),
    ).toEqual([]);
  });

  it('warns about suites to be phased out', async () => {
    const problems = await scanMail(hint, {
      maxVersion: 'TLSv1.2',
      ciphers: 'ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES128-GCM-SHA256',
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.warning);
    expect(problems[0].message).toContain('127.0.0.1: Your mail server');
    expect(problems[0].message).toContain('*phased out*');
    expect(problems[0].sourceCode).toContain(
      'TLSv1.2 TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256',
    );
  });

  it('reports insufficiently secure suites', async () => {
    const problems = await scanMail(hint, {
      maxVersion: 'TLSv1.2',
      ciphers: 'AES128-SHA:ECDHE-RSA-AES128-GCM-SHA256',
    });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toContain(
      'Your mail server supports one or more *insufficiently* secure cipher suites',
    );
    expect(problems[0].sourceCode).toContain(
      'TLSv1.2 TLS_RSA_WITH_AES_128_CBC_SHA',
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
