import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { fetchCertificate } from '../../lib/tls/client.js';
import { describeChain, formatCertificate } from '../../lib/tls/certs.js';
import {
  rateCertificateKey,
  rateSignatureAlgorithm,
} from '../../lib/tls/evaluate.js';
import { onTlsSite } from './on-tls-site.js';
import type { TlsSite } from './on-tls-site.js';

/** Runs the check of the `cert-pubkey` hint against one TLS endpoint. */
export async function checkCertPubkey({
  target,
  report,
  couldNotTest,
  subject,
}: TlsSite): Promise<void> {
  const result = await fetchCertificate(target);
  if (result === null) {
    couldNotTest(`no TLS connection to ${target.host}:${target.port}`);
    return;
  }
  const rated = describeChain(result.chain)
    .filter((cert) => !cert.isRoot)
    .map((cert) => {
      const { rating, description } = rateCertificateKey(cert.key);
      return {
        rating,
        message: `${cert.commonName}: ${description}`,
        evidence: formatCertificate(
          cert,
          description,
          rateSignatureAlgorithm(cert.signatureOid).name,
        ),
      };
    });
  const bad = rated
    .filter((found) => found.rating === 'bad')
    .map((found) => found.message);
  const badEvidence = rated
    .filter((found) => found.rating === 'bad')
    .map((found) => found.evidence);
  const phaseOut = rated
    .filter((found) => found.rating === 'phase-out')
    .map((found) => found.message);
  const phaseOutEvidence = rated
    .filter((found) => found.rating === 'phase-out')
    .map((found) => found.evidence);
  if (bad.length > 0) {
    report(
      `The public key of your ${subject.certificate} is *not* based on a secure signing algorithm with secure parameters: ${bad.join('; ')}.`,
      badEvidence.join('\n\n'),
    );
  }
  if (phaseOut.length > 0) {
    report(
      `The public key of your ${subject.certificate} is based on a signing algorithm with parameters that should be *phased out* as they are weaker, although you might still use them if absolutely needed. In a future update, they will likely become insufficient: ${phaseOut.join('; ')}.`,
      phaseOutEvidence.join('\n\n'),
      Severity.warning,
    );
  }
}

/**
 * Internet.nl "Public key of certificate" (NCSC 3.3.2.1): the public key of
 * the certificate and of every intermediate must use a secure algorithm with
 * secure parameters. RSA needs at least 3072 bits (2048 is phase out), EC
 * needs P-256/384/521 or Brainpool (secp224r1 is phase out), and Ed25519 and
 * Ed448 are always good. Root certificates are not rated.
 */
export default defineHint({
  id: 'cert-pubkey',
  name: 'Certificate public key',
  description:
    'Requires every certificate in the HTTPS chain to use a secure public key type and size.',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, checkCertPubkey);
  },
});
