import { checkTlsRenegotiationSecure } from '../tls/tls-renegotiation-secure.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsRenegotiationSecure: renegotiation without the RFC 5746 extension is insecure (NCSC 3.4.2). It uses `openssl s_client -starttls smtp` when `openssl` is on the PATH, otherwise the hint says it could not test.
 *
 * It is the check of the website hint `tls-renegotiation-secure`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-tls-renegotiation-secure',
  name: 'Mail servers support secure renegotiation',
  description:
    'Requires the mail servers (MX) of the site domain to support secure renegotiation (RFC 5746).',
  check: checkTlsRenegotiationSecure,
});
