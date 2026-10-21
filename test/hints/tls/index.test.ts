import { describe, expect, it } from '@jest/globals';
import { tlsHints } from '../../../src/hints/tls/index.js';

describe('tlsHints', () => {
  it('lists the sixteen Internet.nl TLS and certificate hints once each', () => {
    const ids = tlsHints.map((hint) => hint.id);
    expect(new Set(ids).size).toBe(16);
    expect(ids).toEqual(
      expect.arrayContaining([
        'https-available',
        'tls-version',
        'tls-ciphers',
        'tls-cipher-order',
        'tls-kex-params',
        'tls-kex-hash',
        'tls-ocsp-stapling',
        'cert-trust',
        'cert-pubkey',
        'cert-signature',
        'cert-hostname',
        'tls-compression',
        'tls-renegotiation-secure',
        'tls-renegotiation-client',
        'tls-zero-rtt',
        'tls-ems',
      ]),
    );
  });

  it('puts every hint in the internetnl, tls and security-headers groups', () => {
    for (const hint of tlsHints) {
      expect(hint.groups).toEqual(['internetnl', 'tls', 'security-headers']);
    }
  });
});
