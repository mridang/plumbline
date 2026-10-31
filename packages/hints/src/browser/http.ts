/**
 * @packageDocumentation
 *
 * `node:http` and `node:https` for a browser: the hints use them for requests
 * `fetch` cannot make (any method, any `Host`), so they refuse (see
 * `refusals.ts`).
 */

import { refuse } from './refusals.js';

/** Refuses: a browser can only make the requests `fetch` allows. */
export function request(): never {
  return refuse('socket', 'make a raw HTTP request');
}
