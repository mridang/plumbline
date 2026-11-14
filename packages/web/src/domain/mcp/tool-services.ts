/**
 * @packageDocumentation
 *
 * The outside things this app's tools reach for.
 *
 * They sit behind one interface so that a tool can be tested with fakes instead
 * of a Cloudflare environment, and so that opening the database is something a
 * tool asks for rather than something done for every call: a tool that answers
 * from the check catalogue alone never touches it.
 */

import { getDatabase, type Database } from '@/domain/db/client';

/** What this app's tools reach for. */
export interface ToolServices {
  /**
   * The database, opened when a tool asks for it. A call that needs nothing
   * stored never pays for it.
   */
  readonly openDatabase: () => Database;
}

/** The real database. */
export const liveToolServices: ToolServices = {
  openDatabase: getDatabase,
};
