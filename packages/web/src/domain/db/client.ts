/**
 * @packageDocumentation
 *
 * plumbline's Drizzle client: the generic {@link createDatabase} from
 * `lib/core/db/client` bound to this app's schema. This is where the app's
 * tables meet the library, so `lib/core` never imports the schema. Code with a
 * request context uses {@link getDatabase}; code handed a binding (a test) uses
 * {@link createDatabase}.
 */

import {
  createDatabase as createGenericDatabase,
  type Database as GenericDatabase,
} from '@/lib/core/db/client';
import { getDB } from '@/lib/core/runtime';
// eslint-disable-next-line sonarjs/no-wildcard-import -- drizzle takes the whole schema module as one object, so every table must be in the namespace
import * as schema from '@/domain/db/schema';

/** A Drizzle client typed against plumbline's schema. */
export type Database = GenericDatabase<typeof schema>;

/** Wrap a raw D1 binding in a client typed against plumbline's schema. */
export function createDatabase(d1: D1Database): Database {
  return createGenericDatabase(d1, schema);
}

/** A typed Drizzle client bound to the request's D1 binding. */
export function getDatabase(): Database {
  return createDatabase(getDB());
}
