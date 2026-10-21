import { checkTlsRenegotiationClient } from '../tls/tls-renegotiation-client.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsRenegotiationClient: a client that may renegotiate at will can exhaust the server (NCSC 3.4.2); Internet.nl rates it as information only, so it is a hint. It uses `openssl s_client -starttls smtp` when `openssl` is on the PATH, otherwise the hint says it could not test.
 *
 * It is the check of the website hint `tls-renegotiation-client`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-tls-renegotiation-client',
  name: 'Mail servers limit client renegotiation',
  description:
    'Checks that the mail servers (MX) of the site domain do not allow unlimited client-initiated renegotiation.',
  check: checkTlsRenegotiationClient,
});
