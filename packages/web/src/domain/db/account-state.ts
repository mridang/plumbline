import { and, eq, isNull } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { oauthGrants } from '@/domain/db/schema';
import { getLink } from '@/domain/db/github';

/**
 * What the account menu needs to word its entries: whether the person has
 * linked GitHub and whether an assistant is approved. Two indexed single-row
 * reads, run together once per page render (the header already loads the user).
 */
export async function connectionState(
  db: Database,
  userId: number,
): Promise<{ github: boolean; assistants: boolean }> {
  const [link, grants] = await Promise.all([
    getLink(db, userId),
    db
      .select({ id: oauthGrants.id })
      .from(oauthGrants)
      .where(
        and(eq(oauthGrants.user_id, userId), isNull(oauthGrants.revoked_at)),
      )
      .limit(1),
  ]);
  return { github: link !== undefined, assistants: grants.length > 0 };
}
