import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import {
  highestLegacyVersion,
  supportedVersions,
  tryConnect,
  type TlsTarget,
} from '../../lib/tls/client.js';
import type { TlsVersion } from '../../lib/tls/constants.js';
import {
  SIGNATURE_ALGORITHMS_BAD_HASH,
  SIGNATURE_ALGORITHMS_PHASE_OUT_HASH,
} from '../../lib/tls/constants.js';
import { onTlsSite, type TlsSite } from './on-tls-site.js';

/**
 * Whether the server completes a handshake when the client offers only the
 * given signature algorithms for the key exchange signature. OpenSSL checks
 * the server's choice against that list, so a completed handshake means the
 * server signed the key exchange with one of those hashes.
 */
async function acceptsOnly(
  target: TlsTarget,
  version: TlsVersion,
  sigalgs: string,
): Promise<boolean> {
  const result = await tryConnect(target, {
    minVersion: version,
    maxVersion: version,
    // Only suites that sign the key exchange: ephemeral key exchange.
    ciphers: 'ECDHE:DHE',
    sigalgs,
  });
  return result !== null;
}

/** Runs the check of the `tls-kex-hash` hint against one TLS endpoint. */
export async function checkTlsKexHash({
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
  const legacy = highestLegacyVersion(versions);
  if (legacy === null) {
    return;
  }
  if (await acceptsOnly(target, legacy, SIGNATURE_ALGORITHMS_BAD_HASH)) {
    report(
      `Your ${subject.server} supports one or more *insufficiently* secure hash functions for key exchange: SHA1.`,
      `${legacy} accepts only: ${SIGNATURE_ALGORITHMS_BAD_HASH.replaceAll(':', ', ')}`,
    );
  } else if (
    await acceptsOnly(target, legacy, SIGNATURE_ALGORITHMS_PHASE_OUT_HASH)
  ) {
    report(
      `Your ${subject.server} supports a hash function for key exchange that should be *phased out* as it is weaker, although you might still use it if absolutely needed. In a future update, it will likely become insufficient: SHA224.`,
      `${legacy} accepts only: ${SIGNATURE_ALGORITHMS_PHASE_OUT_HASH.replaceAll(':', ', ')}`,
      Severity.warning,
    );
  } else {
    // Neither weak hash function is accepted, so nothing is reported.
  }
}

/**
 * Internet.nl "Hash function for key exchange" (NCSC 3.3.5): the digital
 * signature in the key exchange must not use SHA-1 (insufficient) and
 * should not use SHA-224 (phase out). It only applies to TLS 1.2 and older,
 * because TLS 1.3 only allows secure hashes.
 *
 * The test offers a signature algorithm list holding only the weak hash and
 * sees whether the handshake still completes. Node cannot tell which hash
 * the server used, so, unlike Internet.nl, there is no second check on the
 * negotiated hash; OpenSSL itself rejects a hash that is not on our list.
 */
export default defineHint({
  id: 'tls-kex-hash',
  name: 'TLS key exchange hash function',
  description:
    'Requires the HTTPS server not to sign the TLS key exchange with weak hash functions (SHA-1, SHA-224).',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, checkTlsKexHash);
  },
});
