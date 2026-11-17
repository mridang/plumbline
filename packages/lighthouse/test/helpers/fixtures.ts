import type { Artifacts } from 'lighthouse';
import type AuditNS from 'lighthouse/types/audit.js';

/** A value with every field, at any depth, optional. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

/**
 * The artifacts a check test supplies. A real run hands a check only the
 * artifacts it declares, so a fixture carries those and leaves the rest out.
 */
export function artifactsOf(value: DeepPartial<Artifacts>): Artifacts {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- a check reads only the artifacts it declares, so a fixture holds those alone
  return value as Artifacts;
}

/** A devtools log of the given protocol events, as the checks' tests build them. */
export function devtoolsLogOf(
  events: readonly object[],
): Artifacts['DevtoolsLog'] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the events are the few protocol messages NetworkRecords reads, not complete Chrome DevTools events
  return events as Artifacts['DevtoolsLog'];
}

/** An audit context carrying only what the check under test reads. */
export function contextOf(
  value: DeepPartial<AuditNS.Context> = {},
): AuditNS.Context {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the checks never read the context beyond the computed-artifact cache
  return value as AuditNS.Context;
}

/** One element artifact (a meta or link element, an image) with the fields a test sets. */
export function elementOf<T extends object>(value: DeepPartial<T>): T {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- the readers under test touch only the fields a test sets
  return value as T;
}
