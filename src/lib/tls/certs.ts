/**
 * Reads what the certificate hints need from the chain a server sent:
 * names, public keys, signature algorithms and which certificates are
 * roots. Uses only Node's `crypto` and `tls`, plus the small DER reader.
 */
import { rootCertificates } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { signatureAlgorithmOid } from './der.js';
import type { CertKey } from './evaluate.js';

/** One certificate of the chain, ready to be rated. */
export interface ChainCertificate {
  /** The subject common name, or `-` as Internet.nl prints it. */
  commonName: string;
  key: CertKey;
  /** Dotted OID of the signature algorithm. */
  signatureOid: string;
  /** True for trust anchors, which Internet.nl does not rate. */
  isRoot: boolean;
}

/** SHA-1 fingerprints of the roots Node trusts, to recognise a root. */
let rootFingerprints: Set<string> | null = null;

function knownRoots(): Set<string> {
  rootFingerprints ??= new Set(
    rootCertificates.map((pem) => new X509Certificate(pem).fingerprint),
  );
  return rootFingerprints;
}

/** The common name from an X.509 subject string, or `-`. */
export function commonName(subject: string): string {
  return /^CN=(.*)$/m.exec(subject)?.[1] ?? '-';
}

/** The public key type and parameters of a certificate. */
function keyOf(cert: X509Certificate): CertKey {
  const key = cert.publicKey;
  const details = key.asymmetricKeyDetails;
  return {
    type: key.asymmetricKeyType ?? 'unknown',
    modulusLength: details?.modulusLength,
    curve: details?.namedCurve,
  };
}

/**
 * Describes a chain of DER certificates, leaf first. A certificate is a
 * root when Node trusts it, or when it is self-issued and not the leaf
 * (Internet.nl skips roots because their own signature is irrelevant).
 */
export function describeChain(chain: readonly Buffer[]): ChainCertificate[] {
  return chain.map((der, index) => {
    const cert = new X509Certificate(der);
    return {
      commonName: commonName(cert.subject),
      key: keyOf(cert),
      signatureOid: signatureAlgorithmOid(der),
      isRoot:
        knownRoots().has(cert.fingerprint) ||
        (index > 0 && cert.checkIssued(cert)),
    };
  });
}
