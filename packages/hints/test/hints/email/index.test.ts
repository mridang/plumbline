import { describe, expect, it } from '@jest/globals';
import { emailHints } from '../../../src/hints/email/index.js';

describe('emailHints', () => {
  it('lists the twenty-seven mail hints', () => {
    expect(
      emailHints.map((hint) => hint.id).toSorted((a, b) => a.localeCompare(b)),
    ).toEqual([
      'mail-caa',
      'mail-cert-hostname',
      'mail-cert-pubkey',
      'mail-cert-signature',
      'mail-cert-trust',
      'mail-dane',
      'mail-dane-rollover',
      'mail-dkim',
      'mail-dmarc',
      'mail-dnssec',
      'mail-ipv6',
      'mail-ns-rpki-exists',
      'mail-ns-rpki-valid',
      'mail-rpki',
      'mail-spf',
      'mail-starttls',
      'mail-tls-cipher-order',
      'mail-tls-ciphers',
      'mail-tls-compression',
      'mail-tls-ems',
      'mail-tls-kex-hash',
      'mail-tls-kex-params',
      'mail-tls-ocsp-stapling',
      'mail-tls-renegotiation-client',
      'mail-tls-renegotiation-secure',
      'mail-tls-version',
      'mail-tls-zero-rtt',
    ]);
  });

  it('puts every hint in the internetnl and email groups', () => {
    for (const hint of emailHints) {
      expect(hint.groups).toEqual(
        expect.arrayContaining(['internetnl', 'email']),
      );
    }
  });
});
