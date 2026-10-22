import { checkTlsCompression } from '../tls/tls-compression.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsCompression: TLS compression leaks secret data (CRIME), so the server must not negotiate it (NCSC 3.4.1). It uses `openssl s_client -starttls smtp` when `openssl` is on the PATH, otherwise the hint says it could not test.
 *
 * It is the check of the website hint `tls-compression`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-tls-compression',
  name: 'Mail servers disable TLS compression',
  description:
    'Requires the mail servers (MX) of the site domain not to support TLS compression.',
  check: checkTlsCompression,
});
