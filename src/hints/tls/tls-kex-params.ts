import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import {
  acceptedCiphers,
  highestLegacyVersion,
  supportedVersions,
  tryConnect,
} from '../../lib/tls/client.js';
import { evaluateKex, type EphemeralKey } from '../../lib/tls/evaluate.js';
import { onTlsSite, type TlsSite } from './on-tls-site.js';

/** Curves offered one by one to learn which ones the server accepts. */
const CURVES = [
  'X25519',
  'X448',
  'prime256v1',
  'secp384r1',
  'secp521r1',
  'secp224r1',
  'secp256k1',
  'brainpoolP256r1',
  'brainpoolP384r1',
  'brainpoolP512r1',
];

/** Runs the check of the `tls-kex-params` hint against one TLS endpoint. */
export async function checkTlsKexParams({
  target,
  report,
  couldNotTest,
  subject,
}: TlsSite): Promise<void> {
  const versions = await supportedVersions(target);
  if (versions.length === 0) {
    couldNotTest(`no TLS connection to ${target.host}:${target.port}`);
    return;
  }
  const keys: EphemeralKey[] = [];
  const legacy = highestLegacyVersion(versions);
  if (legacy !== null) {
    for (const cipher of await acceptedCiphers(target, legacy)) {
      if (cipher.ephemeral) {
        keys.push(cipher.ephemeral);
      }
    }
    for (const curve of CURVES) {
      const result = await tryConnect(target, {
        minVersion: legacy,
        maxVersion: legacy,
        ciphers: 'ECDHE',
        ecdhCurve: curve,
      });
      if (result?.ephemeral?.type === 'ECDH') {
        keys.push(result.ephemeral);
      }
    }
  }
  if (versions.includes('TLSv1.3')) {
    // Node does not report the group of a TLS 1.3 handshake, so the
    // curve we offered and the server accepted is the evidence.
    for (const curve of CURVES) {
      const result = await tryConnect(target, {
        minVersion: 'TLSv1.3',
        maxVersion: 'TLSv1.3',
        ecdhCurve: curve,
      });
      if (result !== null) {
        keys.push({ type: 'ECDH', name: curve, size: 0 });
      }
    }
  }
  const { bad, phaseOut } = evaluateKex(keys);
  if (bad.length > 0) {
    report(
      `Your ${subject.server} supports *insufficiently* secure parameters for Diffie-Hellman key exchange: ${bad.join(', ')}.`,
      bad.join('\n'),
    );
  }
  if (phaseOut.length > 0) {
    report(
      `Your ${subject.server} supports parameters for Diffie-Hellman key exchange that should be *phased out* as they are weaker, although you might still use them if absolutely needed. In a future update, they will likely become insufficient: ${phaseOut.join(', ')}.`,
      phaseOut.join('\n'),
      Severity.warning,
    );
  }
}

/**
 * Internet.nl "Parameters for key exchange": the ephemeral Diffie-Hellman
 * parameters must be secure (NCSC 3.3.2.1 and 3.3.3.1). Elliptic curves must
 * be good (P-256/384/521, Brainpool, X25519, X448), with secp224r1 to be
 * phased out. Finite field DH is at best phase out, and then only with an
 * RFC 7919 group.
 *
 * The parameters come from `getEphemeralKeyInfo()` of every accepted cipher
 * suite below TLS 1.3, plus one handshake per curve to find every curve the
 * server accepts. Node does not report the DH prime, so DH of 3072 bits or
 * more is assumed to be an RFC 7919 group (phase out) and smaller DH is
 * insufficient.
 */
export default defineHint({
  id: 'tls-kex-params',
  name: 'TLS key exchange parameters',
  description:
    'Requires the ephemeral Diffie-Hellman parameters of the HTTPS server (DH size, EC curves) to be secure.',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, checkTlsKexParams);
  },
});
