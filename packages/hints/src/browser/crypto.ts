/**
 * @packageDocumentation
 *
 * `node:crypto` for a browser. The hints use it to read certificates and keys,
 * which only come from the raw connections a browser cannot open, or in a form
 * the browser's own Web Crypto does not read synchronously; so it refuses (see
 * `refusals.ts`).
 */

import { refuse } from './refusals.js';

/** Refuses: there is no certificate parser in a browser. */
export class X509Certificate {
  public constructor() {
    refuse('crypto', 'parse an X.509 certificate');
  }
}

/** Refuses: a browser has no synchronous hash. */
export function createHash(): never {
  return refuse('crypto', 'hash synchronously');
}

/** Refuses: a browser has no synchronous key parser. */
export function createPublicKey(): never {
  return refuse('crypto', 'parse a public key synchronously');
}
