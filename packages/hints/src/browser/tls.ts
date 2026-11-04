/**
 * @packageDocumentation
 *
 * `node:tls` for a browser: connecting refuses (see `refusals.ts`), and there
 * is no root store to read.
 */

import { refuse } from './refusals.js';

/** No roots: a browser does not expose its trust store. */
export const rootCertificates: readonly string[] = [];

/** Refuses: a browser cannot open a TLS connection it can inspect. */
export function connect(): never {
  return refuse('socket', 'open a TLS connection it can inspect');
}

/** Refuses: there is no certificate to check without a connection. */
export function checkServerIdentity(): never {
  return refuse('socket', 'check a certificate it never received');
}

export default { connect, checkServerIdentity, rootCertificates };
