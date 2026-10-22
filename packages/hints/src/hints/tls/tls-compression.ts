import { Category, defineHint } from '../../core/define-hint.js';
import { tryConnect } from '../../lib/tls/client.js';
import { testCompression } from '../../lib/tls/openssl.js';
import { onTlsSite, type TlsSite } from './on-tls-site.js';

/** Runs the check of the `tls-compression` hint against one TLS endpoint. */
export async function checkTlsCompression({
  target,
  report,
  couldNotTest,
  subject,
}: TlsSite): Promise<void> {
  // compression is negotiated at TLS 1.2 and older
  if (
    (await tryConnect(target, {
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.2',
    })) === null
  ) {
    return;
  }
  const outcome = await testCompression(target);
  if (outcome.kind === 'unavailable') {
    couldNotTest('openssl not available');
    return;
  }
  if (outcome.kind === 'failed') {
    couldNotTest(outcome.reason);
    return;
  }
  if (outcome.value === 'compressed') {
    report(
      `Your ${subject.server} supports TLS compression, which is *not* secure.`,
      outcome.evidence,
    );
  } else if (outcome.value === 'cannot-compress') {
    couldNotTest('this openssl was built without TLS compression support');
  }
}

/**
 * Internet.nl "TLS compression" (NCSC 3.4.1): TLS compression leaks secret
 * data to an attacker who can influence the traffic (CRIME), so the server
 * must not negotiate it. Uses `openssl s_client -comp` when openssl is on the
 * PATH, because Node cannot offer compression.
 */
export default defineHint({
  id: 'tls-compression',
  name: 'TLS compression',
  description: 'Requires the HTTPS server not to support TLS compression.',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, checkTlsCompression);
  },
});
