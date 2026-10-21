import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { fetchCertificate } from '../../lib/tls/client.js';
import { describeChain, formatCertificate } from '../../lib/tls/certs.js';
import {
  rateCertificateKey,
  rateSignatureAlgorithm,
} from '../../lib/tls/evaluate.js';
import { onTlsSite, type TlsSite } from './on-tls-site.js';

/** Runs the check of the `cert-signature` hint against one TLS endpoint. */
export async function checkCertSignature({
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
  const bad: string[] = [];
  const phaseOut: string[] = [];
  const badEvidence: string[] = [];
  const phaseOutEvidence: string[] = [];
  for (const cert of describeChain(result.chain)) {
    if (cert.isRoot) {
      continue;
    }
    const { rating, name } = rateSignatureAlgorithm(cert.signatureOid);
    const evidence = formatCertificate(
      cert,
      rateCertificateKey(cert.key).description,
      name,
    );
    if (rating === 'bad') {
      bad.push(`${cert.commonName}: ${name}`);
      badEvidence.push(evidence);
    } else if (rating === 'phase-out') {
      phaseOut.push(`${cert.commonName}: ${name}`);
      phaseOutEvidence.push(evidence);
    }
  }
  if (bad.length > 0) {
    report(
      `Your ${subject.certificate} is signed using an *insufficiently* secure signing algorithm and hash function: ${bad.join('; ')}.`,
      badEvidence.join('\n\n'),
    );
  }
  if (phaseOut.length > 0) {
    report(
      `Your ${subject.certificate} is signed using a signing algorithm and hash function that should be *phased out* as they are weaker, although you might still use them if absolutely needed. In a future update, they will likely become insufficient: ${phaseOut.join('; ')}.`,
      phaseOutEvidence.join('\n\n'),
      Severity.warning,
    );
  }
}

/**
 * Internet.nl "Signature on certificate" (NCSC 3.3.2 and 3.3.5): every
 * certificate in the chain, except the root, must be signed with a secure
 * algorithm and hash: RSA or ECDSA with SHA-256, SHA-384 or SHA-512, or
 * EdDSA. SHA-224 is phase out; anything else (SHA-1, MD5, RSA-PSS as in
 * Internet.nl's list) is insufficient.
 */
export default defineHint({
  id: 'cert-signature',
  name: 'Certificate signature algorithm',
  description:
    'Requires every certificate in the HTTPS chain to be signed with a secure algorithm and hash function.',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, checkCertSignature);
  },
});
