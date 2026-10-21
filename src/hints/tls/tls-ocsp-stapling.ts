import { Severity } from '@hint/utils-types';
import { Category, defineHint } from '../../core/define-hint.js';
import { tryConnect } from '../../lib/tls/client.js';
import { rateOcsp } from '../../lib/tls/evaluate.js';
import { onTlsSite } from './on-tls-site.js';

/**
 * Internet.nl "OCSP stapling": when the certificate has an OCSP pointer, the
 * server should staple a response (TLS Certificate Status extension, RFC
 * 6961). The hint asks for one with `requestOCSP`. Internet.nl also validates
 * the stapled response; Node does not expose that, so a stapled response is
 * accepted as good here. Without an OCSP pointer the check does not apply.
 * Internet.nl rates a missing staple as information only, so it is a hint.
 */
export default defineHint({
  id: 'tls-ocsp-stapling',
  name: 'OCSP stapling',
  description:
    'Checks that the HTTPS server staples an OCSP response when its certificate has an OCSP pointer.',
  category: Category.security,
  groups: ['internetnl', 'tls', 'security-headers'],
  reference:
    'https://github.com/internetstandards/Internet.nl/blob/main/documentation/tls.md',
  setup(context) {
    onTlsSite(context, async ({ target, report, couldNotTest }) => {
      const result = await tryConnect(target, { requestOCSP: true });
      if (result === null) {
        couldNotTest(`no TLS connection to ${target.host}:${target.port}`);
        return;
      }
      // Node lists the Authority Information Access entries by method name.
      const pointer = result.peerCertificate.infoAccess?.['OCSP - URI'];
      const status = rateOcsp(
        (pointer?.length ?? 0) > 0,
        result.ocspResponse !== null && result.ocspResponse.length > 0,
      );
      if (status === 'ok') {
        report(
          'Your web server does *not* support OCSP stapling, although your website certificate has an OCSP pointer.',
          Severity.hint,
        );
      }
    });
  },
});
