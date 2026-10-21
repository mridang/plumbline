import type { HintDefinition } from '../../core/define-hint.js';
import certHostname from './cert-hostname.js';
import certPubkey from './cert-pubkey.js';
import certSignature from './cert-signature.js';
import certTrust from './cert-trust.js';
import tlsCipherOrder from './tls-cipher-order.js';
import tlsCiphers from './tls-ciphers.js';
import tlsCompression from './tls-compression.js';
import tlsEms from './tls-ems.js';
import tlsKexHash from './tls-kex-hash.js';
import tlsKexParams from './tls-kex-params.js';
import tlsOcspStapling from './tls-ocsp-stapling.js';
import tlsRenegotiationClient from './tls-renegotiation-client.js';
import tlsRenegotiationSecure from './tls-renegotiation-secure.js';
import tlsVersion from './tls-version.js';
import tlsZeroRtt from './tls-zero-rtt.js';

/** Hints of the `tls` set. */
export const tlsHints: readonly HintDefinition[] = [
  tlsVersion,
  tlsCiphers,
  tlsCipherOrder,
  tlsKexParams,
  tlsKexHash,
  tlsOcspStapling,
  certTrust,
  certPubkey,
  certSignature,
  certHostname,
  tlsCompression,
  tlsRenegotiationSecure,
  tlsRenegotiationClient,
  tlsZeroRtt,
  tlsEms,
];
