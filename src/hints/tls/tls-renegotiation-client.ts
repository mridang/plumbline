import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { tryConnect } from '../../lib/tls/client.js';
import { testClientRenegotiation } from '../../lib/tls/openssl.js';
import { rateClientRenegotiation } from '../../lib/tls/evaluate.js';
import { onTlsSite } from './on-tls-site.js';

/**
 * Internet.nl "Client-initiated renegotiation" (NCSC 3.4.2): a client that may
 * renegotiate at will can exhaust the server. It is acceptable when the
 * server refuses it or limits it to ten renegotiations. The test asks
 * `openssl s_client -tls1_2` to renegotiate eleven times and counts the
 * completed handshakes. Internet.nl rates a failure as information only, so
 * it is reported as a hint.
 */
export default defineHint({
  id: 'tls-renegotiation-client',
  name: 'TLS client-initiated renegotiation',
  description:
    'Checks that the HTTPS server does not allow unlimited client-initiated renegotiation.',
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
      const outcome = await testClientRenegotiation(target);
      if (outcome.kind === 'unavailable') {
        couldNotTest('openssl not available');
        return;
      }
      if (outcome.kind === 'failed') {
        couldNotTest(outcome.reason);
        return;
      }
      if (
        rateClientRenegotiation(outcome.value) === 'allowed-with-too-high-limit'
      ) {
        report(
          'Your web server allows for client-initiated renegotiation, which could have negative impact on the availability of your website.',
          outcome.evidence,
          Severity.hint,
        );
      }
    });
  },
});
