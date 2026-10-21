import { Category, defineHint } from '../../core/define-hint.js';
import { fetchCertificate } from '../../lib/tls/client.js';
import { onTlsSite } from './on-tls-site.js';

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
    onTlsSite(context, async ({ target, report, couldNotTest }) => {
      const result = await fetchCertificate(target);
      if (result === null) {
        couldNotTest(`no TLS connection to ${target.host}:${target.port}`);
        return;
      }
      if (!result.authorized) {
        report(
          `The trust chain of your website certificate is *not* complete and/or *not* signed by a trusted root certificate authority (${result.authorizationError ?? 'unknown error'}).`,
        );
      }
    });
  },
});
