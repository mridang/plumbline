/**
 * @packageDocumentation
 *
 * `node:fs/promises`, `node:os` and `node:path` for a browser, as far as the
 * hints use them (to hand openssl a file): writing refuses (see
 * `refusals.ts`).
 */

import { refuse } from './refusals.js';

/** A refusal to touch the file system, as a rejected promise. */
function refused(): Promise<never> {
  return new Promise(() => refuse('file', 'write a file'));
}

/** Refuses: a browser has no file system. */
export function mkdtemp(): Promise<never> {
  return refused();
}

/** Refuses: a browser has no file system. */
export function writeFile(): Promise<never> {
  return refused();
}

/** Refuses: a browser has no file system. */
export function rm(): Promise<never> {
  return refused();
}

/** No temporary folder in a browser. */
export function tmpdir(): string {
  return '';
}

/** Joins path pieces with `/`. */
export function join(...parts: readonly string[]): string {
  return parts.join('/');
}
