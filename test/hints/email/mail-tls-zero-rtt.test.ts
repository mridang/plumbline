import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-tls-zero-rtt.js';
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

describe('mail-tls-zero-rtt', () => {
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
    expect((await scanClosedMail(hint)).problems).toEqual([]);
  });

  it('does not apply without TLS 1.3', async () => {
    missingOpenssl();
    expect(
      await scanMail(hint, { keepOpen: true, maxVersion: 'TLSv1.2' }),
    ).toEqual([]);
  });

  it('passes when early data is refused', async () => {
    fakeOpenssl('Early data was rejected');
    expect(await scanMail(hint, { keepOpen: true })).toEqual([]);
  });

  it('reports accepted early data, upgrading with STARTTLS', async () => {
    fakeOpenssl('Early data was accepted');
    const problems = await scanMail(hint, { keepOpen: true });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toBe(
      '127.0.0.1: Your mail server supports 0-RTT, which is *not* secure.',
    );
    expect(problems[0].sourceCode).toMatch(
      /^\$ openssl s_client -connect 127\.0\.0\.1:\d+ -starttls smtp /,
    );
    expect(problems[0].sourceCode).toContain('Early data was accepted');
  });
});
