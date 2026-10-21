import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-cert-trust.js';
import { scanClosedMail, scanMail } from '../../lib/email/mail-tls.js';
import { restoreProbe } from '../../lib/tls/local-server.js';

afterEach(() => {
  restoreProbe();
});

describe('mail-cert-trust', () => {
  it('belongs to the internetnl, email and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'tls']);
  });

  it('passes when the chain leads to a trusted root', async () => {
    expect(await scanMail(hint)).toEqual([]);
  });

  it('informs about a certificate from an unknown authority', async () => {
    const problems = await scanMail(hint, {}, false);
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toContain(
      '127.0.0.1: The trust chain of your mail server certificate is *not* complete',
    );
    expect(problems[0].message).toContain('UNABLE_TO_VERIFY_LEAF_SIGNATURE');
    expect(problems[0].sourceCode).toContain(
      'Error: UNABLE_TO_VERIFY_LEAF_SIGNATURE',
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
