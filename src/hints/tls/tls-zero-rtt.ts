import { Category, defineHint } from '../../core/define-hint.js';
import { tryConnect } from '../../lib/tls/client.js';
import { testZeroRtt } from '../../lib/tls/openssl.js';
import { onTlsSite, type TlsSite } from './on-tls-site.js';

/** Runs the check of the `tls-zero-rtt` hint against one TLS endpoint. */
export async function checkTlsZeroRtt({
  target,
  report,
  couldNotTest,
  subject,
}: TlsSite): Promise<void> {
  // early data only exists in TLS 1.3
  if (
    (await tryConnect(target, {
      minVersion: 'TLSv1.3',
      maxVersion: 'TLSv1.3',
    })) === null
  ) {
    return;
  }
  const outcome = await testZeroRtt(target);
  if (outcome.kind === 'unavailable') {
    couldNotTest('openssl not available');
    return;
  }
  if (outcome.kind === 'failed') {
    couldNotTest(outcome.reason);
    return;
  }
  if (outcome.value) {
    report(
      `Your ${subject.server} supports 0-RTT, which is *not* secure.`,
      outcome.evidence,
    );
  }
}

/**
 * Internet.nl "0-RTT": TLS 1.3 early data has no replay protection at the TLS
 * layer, so servers should not accept it. Uses `openssl s_client -tls1_3` to
 * save a session, then resume it sending early data. It is not tested when
 * the server does not accept TLS 1.3.
 */
export default defineHint({
  id: 'tls-zero-rtt',
  name: 'TLS 0-RTT',
  description:
    'Requires the HTTPS server not to accept TLS 1.3 0-RTT early data.',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, checkTlsZeroRtt);
  },
});
