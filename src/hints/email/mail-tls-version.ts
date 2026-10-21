import { checkTlsVersion } from '../tls/tls-version.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsVersion: the server may only accept secure TLS versions (TLS 1.3 good, TLS 1.2 sufficient; NCSC guideline 3.3.1). Every version is probed with its own handshake after the STARTTLS upgrade.
 *
 * It is the check of the website hint `tls-version`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-tls-version',
  name: 'Mail servers accept only secure TLS versions',
  description:
    'Requires the mail servers (MX) of the site domain to accept only secure TLS versions (TLS 1.3 and TLS 1.2) over STARTTLS.',
  check: checkTlsVersion,
});
