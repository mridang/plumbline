import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-tls-renegotiation-secure.js';
import { scanClosedMail, scanMail } from '../../lib/email/mail-tls.js';
import { restoreProbe } from '../../lib/tls/local-server.js';
import {
  fakeOpenssl,
  missingOpenssl,
  restoreOpenssl,
} from '../../lib/tls/fake-openssl.js';

afterEach(() => {
  restoreProbe();
  restoreOpenssl();
});

describe('mail-tls-renegotiation-secure', () => {
  it('belongs to the internetnl, email and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'tls']);
  });

  it('says so when openssl is not available', async () => {
    missingOpenssl();
    const problems = await scanMail(hint, { keepOpen: true });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toBe(
      '127.0.0.1: Could not test: openssl not available.',
    );
  });

  it('does not apply when the mail server cannot be reached', async () => {
    missingOpenssl();
    const closed = await scanClosedMail(hint);
    expect(closed.problems).toEqual([]);
  });

  it('passes when secure renegotiation is supported', async () => {
    fakeOpenssl('Secure Renegotiation IS supported');
    expect(await scanMail(hint, { keepOpen: true })).toEqual([]);
  });

  it('reports insecure renegotiation, upgrading with STARTTLS', async () => {
    fakeOpenssl('Secure Renegotiation IS NOT supported');
    const problems = await scanMail(hint, { keepOpen: true });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toBe(
      '127.0.0.1: Your mail server supports insecure renegotiation, which is obviously *not* secure.',
    );
    expect(problems[0].sourceCode).toMatch(
      /^\$ openssl s_client -connect 127\.0\.0\.1:\d+ -starttls smtp /,
    );
    expect(problems[0].sourceCode).toContain(
      'Secure Renegotiation IS NOT supported',
    );
  });
});
