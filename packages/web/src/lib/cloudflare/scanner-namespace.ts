/**
 * @packageDocumentation
 *
 * Which Durable Object namespace runs the checks. `SCAN_ENGINE` in
 * `wrangler.jsonc` picks it: `container` runs every check in Node inside the
 * scanner container (`ScannerContainer`), `worker` runs them in the Durable Object
 * itself and asks a small probe container only for what needs real sockets
 * (`ProbeScanner`). Both answer the same requests, so nothing else changes.
 */

import type { ScannerNamespace } from '@/domain/scan/run';

/** The bindings the choice reads. */
export interface ScannerBindings {
  readonly SCANNER?: unknown;
  readonly PROBE?: unknown;
  readonly SCAN_ENGINE?: string;
}

/** The namespace the checks run in, or undefined when it is not bound. */
export function scannerNamespace(
  env: ScannerBindings,
): ScannerNamespace | undefined {
  const bound = env.SCAN_ENGINE === 'worker' ? env.PROBE : env.SCANNER;
  return bound as ScannerNamespace | undefined;
}
