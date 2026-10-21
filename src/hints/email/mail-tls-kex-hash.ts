import { checkTlsKexHash } from '../tls/tls-kex-hash.js';
import { defineMailTlsHint } from './on-mail-tls.js';

/**
 * Internet.nl, email test, subtest MailTlsKexHashFunc: the signature in the key exchange must not use SHA-1 (insufficient) and should not use SHA-224 (phase out); it only applies to TLS 1.2 and older.
 *
 * It is the check of the website hint `tls-kex-hash`, run against every receiving mail
 * server (MX) of the site's registrable domain over SMTP STARTTLS on port 25,
 * with the evidence reported per mail server. A server that cannot be reached
 * or does not offer STARTTLS is reported as information (`mail-starttls`
 * reports the missing STARTTLS), and the hint stays silent when the domain has
 * no MX records.
 */
export default defineMailTlsHint({
  id: 'mail-tls-kex-hash',
  name: 'Mail servers use a secure key exchange hash function',
  description:
    'Requires the mail servers (MX) not to sign the TLS key exchange with weak hash functions (SHA-1, SHA-224).',
  check: checkTlsKexHash,
});
