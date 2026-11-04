/**
 * @packageDocumentation
 *
 * `node:child_process` for a browser: starting a program refuses (see
 * `refusals.ts`).
 */

import { refuse } from './refusals.js';

/** Refuses: a browser cannot start a program such as openssl. */
export function spawn(): never {
  return refuse('process', 'start a program such as openssl');
}
