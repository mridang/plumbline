import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-tls-ems.js';
import { scanClosedMail, scanMail } from '../../lib/email/mail-tls.js';
import { restoreProbe } from '../../lib/tls/local-server.js';
import {
  fakeOpenssl,
  missingOpenssl,
  realIt,
  restoreOpenssl,
} from '../../lib/tls/fake-openssl.js';

afterEach(() => {
  restoreProbe();
  restoreOpenssl();
});

describe('mail-tls-ems', () => {
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

  it('passes when the extended master secret is used', async () => {
    fakeOpenssl('Extended master secret: yes');
    expect(await scanMail(hint, { keepOpen: true })).toEqual([]);
  });

  it('reports a missing extended master secret, upgrading with STARTTLS', async () => {
    fakeOpenssl('Extended master secret: no');
    const problems = await scanMail(hint, { keepOpen: true });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toBe(
      '127.0.0.1: Your mail server does *not* support EMS.',
    );
    expect(problems[0].sourceCode).toMatch(
      /^\$ openssl s_client -connect 127\.0\.0\.1:\d+ -starttls smtp /,
    );
    expect(problems[0].sourceCode).toContain('Extended master secret: no');
  });

  realIt('passes against a real mail server', async () => {
    expect(
      await scanMail(hint, { keepOpen: true, minVersion: 'TLSv1.2' }),
    ).toEqual([]);
  });
});
