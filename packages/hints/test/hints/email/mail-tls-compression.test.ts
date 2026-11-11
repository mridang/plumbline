import { afterEach, describe, expect, it } from '@jest/globals';
import { Severity } from '@hint/utils-types';
import hint from '../../../src/hints/email/mail-tls-compression.js';
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

describe('mail-tls-compression', () => {
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

  it('passes when compression is not negotiated', async () => {
    fakeOpenssl('Compression: NONE\n', 'compression_methods (len=2)\n');
    expect(await scanMail(hint, { keepOpen: true })).toEqual([]);
  });

  it('reports negotiated compression, upgrading with STARTTLS', async () => {
    fakeOpenssl('Compression: zlib\n', 'compression_methods (len=2)\n');
    const problems = await scanMail(hint, { keepOpen: true });
    expect(problems).toHaveLength(1);
    expect(problems[0].severity).toBe(Severity.error);
    expect(problems[0].message).toBe(
      '127.0.0.1: Your mail server supports TLS compression, which is *not* secure.',
    );
    expect(problems[0].sourceCode).toMatch(
      /^\$ openssl s_client -connect 127\.0\.0\.1:\d+ -starttls smtp /,
    );
    expect(problems[0].sourceCode).toContain('Compression: zlib');
  });
});
