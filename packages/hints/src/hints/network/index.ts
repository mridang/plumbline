import type { HintDefinition } from '../../core/define-hint.js';
import caa from './caa.js';
import daneExists from './dane-exists.js';
import daneRollover from './dane-rollover.js';
import daneValid from './dane-valid.js';
import dnssecExists from './dnssec-exists.js';
import dnssecValid from './dnssec-valid.js';
import httpCompression from './internetnl-http-compression.js';
import ipv6NsAaaa from './ipv6-ns-aaaa.js';
import ipv6NsReach from './ipv6-ns-reach.js';
import ipv6SameContent from './ipv6-same-content.js';
import ipv6WebAaaa from './ipv6-web-aaaa.js';
import ipv6WebReach from './ipv6-web-reach.js';
import rpkiNsExists from './rpki-ns-exists.js';
import rpkiNsValid from './rpki-ns-valid.js';
import rpkiWebExists from './rpki-web-exists.js';
import rpkiWebValid from './rpki-web-valid.js';

/** Hints of the `network` set (IPv6, DNSSEC, DANE, RPKI, CAA, compression). */
export const networkHints: readonly HintDefinition[] = [
  ipv6NsAaaa,
  ipv6NsReach,
  ipv6WebAaaa,
  ipv6WebReach,
  ipv6SameContent,
  dnssecExists,
  dnssecValid,
  daneExists,
  daneValid,
  daneRollover,
  rpkiNsExists,
  rpkiNsValid,
  rpkiWebExists,
  rpkiWebValid,
  caa,
  httpCompression,
];
