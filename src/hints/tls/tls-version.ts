import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { supportedVersions } from '../../lib/tls/client.js';
import { evaluateProtocols, formatVersion } from '../../lib/tls/evaluate.js';
import { onTlsSite } from './on-tls-site.js';

/**
 * Internet.nl "TLS version": the server may only accept secure TLS versions,
 * that is TLS 1.3 (good) and TLS 1.2 (sufficient), NCSC guideline 3.3.1.
 *
 * Every version is probed with its own handshake (minimum and maximum set to
 * that version). SSL 2.0 and 3.0 cannot be tested because Node's TLS stack
 * does not implement them; a server that only offers those is unreachable
 * for any modern client anyway.
 */
export default defineHint({
  id: 'tls-version',
  name: 'TLS version',
  description:
    'Requires the HTTPS server to accept only secure TLS versions (TLS 1.3 and TLS 1.2).',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, async ({ target, report, couldNotTest }) => {
      const accepted = await supportedVersions(target);
      if (accepted.length === 0) {
        couldNotTest(`no TLS connection to ${target.host}:${target.port}`);
        return;
      }
      const { bad, phaseOut } = evaluateProtocols(accepted);
      if (bad.length > 0) {
        report(
          `Your web server supports *insufficiently* secure TLS versions: ${bad.map(formatVersion).join(', ')}.`,
          bad.map(formatVersion).join('\n'),
        );
      }
      if (phaseOut.length > 0) {
        report(
          `Your web server supports TLS versions that should be *phased out* deliberately, because they are known to be fragile and at risk of becoming *insufficiently* secure: ${phaseOut.map(formatVersion).join(', ')}.`,
          phaseOut.map(formatVersion).join('\n'),
          Severity.warning,
        );
      }
    });
  },
});
