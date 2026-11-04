import { Category, defineHint } from '../../core/define-hint.js';
import { fetchCertificate } from '../../lib/tls/client.js';
import { onTlsSite } from './on-tls-site.js';

/**
 * Internet.nl "HTTPS available" (subtest WebTlsHttpsExists): the website must
 * offer HTTPS. The hint connects to port 443 of the scanned host and
 * completes a TLS handshake without judging the certificate, which the other
 * TLS hints do; a host that refuses the connection or does not speak TLS
 * does not offer HTTPS. It is the precondition of every other TLS hint, which
 * only say they could not test when it fails.
 */
export default defineHint({
  id: 'https-available',
  name: 'HTTPS available',
  description:
    'Requires the website to be reachable over HTTPS, with a completed TLS handshake on the HTTPS port.',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers', 'roctify'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, async ({ target, report }) => {
      if ((await fetchCertificate(target)) === null) {
        report(
          'Your website does *not* offer HTTPS: no TLS connection could be made.',
          `${target.host}:${target.port} refused the connection or did not complete a TLS handshake`,
        );
      }
    });
  },
});
