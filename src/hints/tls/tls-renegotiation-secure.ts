import { Category, defineHint } from '../../core/define-hint.js';
import { tryConnect } from '../../lib/tls/client.js';
import { testSecureRenegotiation } from '../../lib/tls/openssl.js';
import { onTlsSite } from './on-tls-site.js';

/**
 * Internet.nl "Secure renegotiation" (NCSC 3.4.2): renegotiation without the
 * RFC 5746 extension is insecure and must be disabled. Uses
 * `openssl s_client -tls1_2`, which prints whether the server supports it.
 * Renegotiation does not exist in TLS 1.3, so it is not tested without TLS 1.2.
 */
export default defineHint({
  id: 'tls-renegotiation-secure',
  name: 'TLS secure renegotiation',
  description:
    'Requires the HTTPS server to support secure renegotiation (RFC 5746).',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, async ({ target, report, couldNotTest }) => {
      // renegotiation only exists up to TLS 1.2
      if (
        (await tryConnect(target, {
          minVersion: 'TLSv1.2',
          maxVersion: 'TLSv1.2',
        })) === null
      ) {
        return;
      }
      const outcome = await testSecureRenegotiation(target);
      if (outcome.kind === 'unavailable') {
        couldNotTest('openssl not available');
        return;
      }
      if (outcome.kind === 'failed') {
        couldNotTest(outcome.reason);
        return;
      }
      if (outcome.value === 'not-supported') {
        report(
          'Your web server supports insecure renegotiation, which is obviously *not* secure.',
          outcome.evidence,
        );
      }
    });
  },
});
