import type { HintDefinition } from '../../core/define-hint.js';
import mailCaa from './mail-caa.js';
import mailCertHostname from './mail-cert-hostname.js';
import mailCertPubkey from './mail-cert-pubkey.js';
import mailCertSignature from './mail-cert-signature.js';
import mailCertTrust from './mail-cert-trust.js';
import mailDane from './mail-dane.js';
import mailDaneRollover from './mail-dane-rollover.js';
import mailDkim from './mail-dkim.js';
import mailDmarc from './mail-dmarc.js';
import mailDnssec from './mail-dnssec.js';
import mailIpv6 from './mail-ipv6.js';
import mailNsRpkiExists from './mail-ns-rpki-exists.js';
import mailNsRpkiValid from './mail-ns-rpki-valid.js';
import mailRpki from './mail-rpki.js';
import mailSpf from './mail-spf.js';
import mailStarttls from './mail-starttls.js';
import mailTlsCipherOrder from './mail-tls-cipher-order.js';
import mailTlsCiphers from './mail-tls-ciphers.js';
import mailTlsCompression from './mail-tls-compression.js';
import mailTlsEms from './mail-tls-ems.js';
import mailTlsKexHash from './mail-tls-kex-hash.js';
import mailTlsKexParams from './mail-tls-kex-params.js';
import mailTlsOcspStapling from './mail-tls-ocsp-stapling.js';
import mailTlsRenegotiationClient from './mail-tls-renegotiation-client.js';
import mailTlsRenegotiationSecure from './mail-tls-renegotiation-secure.js';
import mailTlsVersion from './mail-tls-version.js';
import mailTlsZeroRtt from './mail-tls-zero-rtt.js';

/** Hints of the `email` set: Internet.nl's email checks on the site domain. */
export const emailHints: readonly HintDefinition[] = [
  mailCaa,
  mailCertHostname,
  mailCertPubkey,
  mailCertSignature,
  mailCertTrust,
  mailDane,
  mailDaneRollover,
  mailDkim,
  mailDmarc,
  mailDnssec,
  mailIpv6,
  mailNsRpkiExists,
  mailNsRpkiValid,
  mailRpki,
  mailSpf,
  mailStarttls,
  mailTlsCipherOrder,
  mailTlsCiphers,
  mailTlsCompression,
  mailTlsEms,
  mailTlsKexHash,
  mailTlsKexParams,
  mailTlsOcspStapling,
  mailTlsRenegotiationClient,
  mailTlsRenegotiationSecure,
  mailTlsVersion,
  mailTlsZeroRtt,
];
