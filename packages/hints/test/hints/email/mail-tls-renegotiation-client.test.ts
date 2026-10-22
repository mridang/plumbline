import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-tls-renegotiation-client.js';
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

describe('mail-tls-renegotiation-client', () => {
  it('belongs to the internetnl, email and tls groups', () => {
    expect(hint.groups).toEqual(['internetnl', 'email', 'tls']);
  });

  const done =
    'RENEGOTIATING\nSSL_connect:SSL negotiation finished successfully\n';
  const secure = 'Secure Renegotiation IS supported\n';

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
    expect((await scanClosedMail(hint)).problems).toEqual([]);
  });

  it('passes when client renegotiation is limited', async () => {
    fakeOpenssl(secure + done.repeat(10));
    expect(await scanMail(hint, { keepOpen: true })).toEqual([]);
  });

  it('informs about unlimited client renegotiation, upgrading with STARTTLS', async () => {
    fakeOpenssl(secure + done.repeat(11));
    const problems = await scanMail(hint, { keepOpen: true });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.hint);
    expect(problems[0].message).toBe(
      '127.0.0.1: Your mail server allows for client-initiated renegotiation, which could have negative impact on the availability of your mail server.',
    );
    expect(problems[0].sourceCode).toMatch(
      /^\$ openssl s_client -connect 127\.0\.0\.1:\d+ -starttls smtp /,
    );
    expect(problems[0].sourceCode).toContain(
      'client renegotiations completed: 11',
    );
  });
});
