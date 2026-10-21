import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { fetchCertificate } from '../../lib/tls/client.js';
import { describeChain } from '../../lib/tls/certs.js';
import { rateCertificateKey } from '../../lib/tls/evaluate.js';
import { onTlsSite } from './on-tls-site.js';

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
    onTlsSite(context, async ({ target, report, couldNotTest }) => {
      const result = await fetchCertificate(target);
      if (result === null) {
        couldNotTest(`no TLS connection to ${target.host}:${target.port}`);
        return;
      }
      const bad: string[] = [];
      const phaseOut: string[] = [];
      for (const cert of describeChain(result.chain)) {
        if (cert.isRoot) {
          continue;
        }
        const { rating, description } = rateCertificateKey(cert.key);
        const message = `${cert.commonName}: ${description}`;
        if (rating === 'bad') {
          bad.push(message);
        } else if (rating === 'phase-out') {
          phaseOut.push(message);
        }
      }
      if (bad.length > 0) {
        report(
          `The public key of your website certificate is *not* based on a secure signing algorithm with secure parameters: ${bad.join('; ')}.`,
        );
      }
      if (phaseOut.length > 0) {
        report(
          `The public key of your website certificate is based on a signing algorithm with parameters that should be *phased out* as they are weaker, although you might still use them if absolutely needed. In a future update, they will likely become insufficient: ${phaseOut.join('; ')}.`,
          Severity.warning,
        );
      }
    });
  },
});
