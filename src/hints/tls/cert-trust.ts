import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { fetchCertificate } from '../../lib/tls/client.js';
import { describeChain } from '../../lib/tls/certs.js';
import { onTlsSite, type TlsSite } from './on-tls-site.js';

/** Runs the check of the `cert-trust` hint against one TLS endpoint. */
export async function checkCertTrust(
  { target, report, couldNotTest, subject }: TlsSite,
  severity: Severity = Severity.error,
): Promise<void> {
  const result = await fetchCertificate(target);
  if (result === null) {
    couldNotTest(`no TLS connection to ${target.host}:${target.port}`);
    return;
  }
  if (!result.authorized) {
    report(
      `The trust chain of your ${subject.certificate} is *not* complete and/or *not* signed by a trusted root certificate authority (${result.authorizationError ?? 'unknown error'}).`,
      [
        `Error: ${result.authorizationError ?? 'unknown error'}`,
        ...describeChain(result.chain).map(
          (cert, index) =>
            `Certificate ${index + 1}: CN=${cert.commonName}, issued by CN=${cert.issuer}`,
        ),
      ].join('\n'),
      severity,
    );
  }
}

/**
 * Internet.nl "Trust chain of certificate": a valid chain of trust must be
 * built from the certificate the server sends, to a publicly trusted root
 * (Mozilla's, as bundled with Node). The server must send all intermediate
 * certificates and none may have expired.
 */
export default defineHint({
  id: 'cert-trust',
  name: 'Certificate trust chain',
  description:
    'Requires the HTTPS certificate to chain to a trusted root, with all intermediates sent.',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, checkCertTrust);
  },
});
