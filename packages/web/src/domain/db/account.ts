/**
 * @packageDocumentation
 *
 * Erasing a person from the database. Used by account deletion: everything
 * plumbline keeps about someone is keyed by their user id, and all of it goes
 * together, in one transaction, so a failure part-way leaves the account whole
 * rather than half erased.
 */

import { eq, inArray } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import {
  domains,
  liveEvents,
  pushSubscriptions,
  oauthCodes,
  oauthGrants,
  oauthTokens,
  reports,
  users,
} from '@/domain/db/schema';

/**
 * Delete the user row and every row that hangs off it: their domains and the
 * reports of those domains, and the connections they gave to assistants
 * (grants, with the tokens and unspent codes behind them).
 */
export async function deleteAccountData(
  db: Database,
  userId: number,
): Promise<void> {
  await db.batch([
    db
      .delete(oauthTokens)
      .where(
        inArray(
          oauthTokens.grant_id,
          db
            .select({ id: oauthGrants.id })
            .from(oauthGrants)
            .where(eq(oauthGrants.user_id, userId)),
        ),
      ),
    db.delete(oauthCodes).where(eq(oauthCodes.user_id, userId)),
    db.delete(oauthGrants).where(eq(oauthGrants.user_id, userId)),
    db
      .delete(reports)
      .where(
        inArray(
          reports.domain_id,
          db
            .select({ id: domains.id })
            .from(domains)
            .where(eq(domains.user_id, userId)),
        ),
      ),
    db.delete(liveEvents).where(eq(liveEvents.user_id, userId)),
    db.delete(pushSubscriptions).where(eq(pushSubscriptions.user_id, userId)),
    db.delete(domains).where(eq(domains.user_id, userId)),
    db.delete(users).where(eq(users.id, userId)),
  ]);
}
