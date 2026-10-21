import type { HintDefinition } from '../../core/define-hint.js';
import mailDane from './mail-dane.js';
import mailDkim from './mail-dkim.js';
import mailDmarc from './mail-dmarc.js';
import mailDnssec from './mail-dnssec.js';
import mailIpv6 from './mail-ipv6.js';
import mailRpki from './mail-rpki.js';
import mailSpf from './mail-spf.js';
import mailStarttls from './mail-starttls.js';

/** Hints of the `email` set: Internet.nl's email checks on the site domain. */
export const emailHints: readonly HintDefinition[] = [
  mailDane,
  mailDkim,
  mailDmarc,
  mailDnssec,
  mailIpv6,
  mailRpki,
  mailSpf,
  mailStarttls,
];
