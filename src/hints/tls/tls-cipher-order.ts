import { Category, defineHint } from '../../core/define-hint.js';
import {
  acceptedCiphers,
  highestLegacyVersion,
  supportedVersions,
  tryConnect,
} from '../../lib/tls/client.js';
import { evaluateCipherOrder } from '../../lib/tls/evaluate.js';
import { onTlsSite } from './on-tls-site.js';

/**
 * Internet.nl "Cipher suite order": the server must enforce its own cipher
 * preference and prefer good and sufficient suites over phase out ones.
 *
 * The test offers every phase out suite the server accepts, followed by one
 * better suite, and expects the server to pick the better one. A server that
 * simply follows the client's order picks the first, worse, suite. It runs
 * for the highest accepted version below TLS 1.3, because all TLS 1.3 suites
 * are acceptable. It does not apply when the server accepts only suites
 * rated good or sufficient.
 */
export default defineHint({
  id: 'tls-cipher-order',
  name: 'TLS cipher suite order',
  description:
    'Requires the HTTPS server to enforce its own preference for the most secure cipher suites.',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, async ({ target, report, couldNotTest }) => {
      const versions = await supportedVersions(target);
      if (versions.length === 0) {
        couldNotTest(`no TLS connection to ${target.host}:${target.port}`);
        return;
      }
      const legacy = highestLegacyVersion(versions);
      if (legacy === null) {
        return;
      }
      const accepted = await acceptedCiphers(target, legacy);
      const evaluation = await evaluateCipherOrder(
        accepted,
        async (offered) => {
          const result = await tryConnect(target, {
            minVersion: legacy,
            maxVersion: legacy,
            ciphers: offered.map((cipher) => cipher.name).join(':'),
          });
          return result?.cipher ?? null;
        },
      );
      if (evaluation.status === 'bad' && evaluation.violation) {
        const [preferred, expected] = evaluation.violation;
        report(
          `Your web server does *not* enforce its own preference for cipher suites in descending order of their security level: it preferred ${preferred} instead of ${expected}.`,
        );
      }
    });
  },
});
