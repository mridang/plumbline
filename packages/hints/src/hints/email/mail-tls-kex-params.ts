import { checkTlsKexParams } from '../tls/tls-kex-params.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsFsParams: the ephemeral Diffie-Hellman parameters must be secure (NCSC 3.3.2.1 and 3.3.3.1).
 *
 * It is the check of the website hint `tls-kex-params`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-tls-kex-params',
  name: 'Mail servers use secure key exchange parameters',
  description:
    'Requires the ephemeral Diffie-Hellman parameters (DH size, EC curves) of the mail servers (MX) to be secure.',
  check: checkTlsKexParams,
});
