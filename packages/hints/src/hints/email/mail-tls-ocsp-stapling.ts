import { checkTlsOcspStapling } from '../tls/tls-ocsp-stapling.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsOCSPStapling: when the certificate has an OCSP pointer the server should staple a response (RFC 6961); Internet.nl rates a missing staple as information only, so it is a hint.
 *
 * It is the check of the website hint `tls-ocsp-stapling`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-tls-ocsp-stapling',
  name: 'Mail servers staple OCSP responses',
  description:
    'Checks that the mail servers (MX) staple an OCSP response when their certificate has an OCSP pointer.',
  check: checkTlsOcspStapling,
});
