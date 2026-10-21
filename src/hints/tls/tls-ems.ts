import { Category, defineHint } from '../../core/define-hint.js';
import { tryConnect } from '../../lib/tls/client.js';
import { testExtendedMasterSecret } from '../../lib/tls/openssl.js';
import { onTlsSite, type TlsSite } from './on-tls-site.js';

/** Runs the check of the `tls-ems` hint against one TLS endpoint. */
export async function checkTlsEms({
  target,
  report,
  couldNotTest,
  subject,
}: TlsSite): Promise<void> {
  // EMS only exists in TLS 1.2
  if (
    (await tryConnect(target, {
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.2',
    })) === null
  ) {
    return;
  }
  const outcome = await testExtendedMasterSecret(target);
  if (outcome.kind === 'unavailable') {
    couldNotTest('openssl not available');
    return;
  }
  if (outcome.kind === 'failed') {
    couldNotTest(outcome.reason);
    return;
  }
  if (outcome.value === 'not-supported') {
    report(`Your ${subject.server} does *not* support EMS.`, outcome.evidence);
  }
}

/**
 * Internet.nl "Extended Master Secret (EMS)": RFC 7627 prevents triple
 * handshake attacks on TLS 1.2, and TLS libraries increasingly require it.
 * Uses `openssl s_client -tls1_2`, which prints whether it was used. Not
 * applicable when the server does not accept TLS 1.2.
 */
export default defineHint({
  id: 'tls-ems',
  name: 'TLS Extended Master Secret',
  description:
    'Requires the HTTPS server to support the TLS 1.2 Extended Master Secret (RFC 7627).',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, checkTlsEms);
  },
});
