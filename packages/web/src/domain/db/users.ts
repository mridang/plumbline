/**
 * @packageDocumentation
 *
 * Repository for the `users` table: the per-account record created on first
 * Google sign-in. It holds who the person is and which generation of their
 * sessions is still honoured; their domains and reports live in tables of
 * their own.
 */

import { eq, sql } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { users } from '@/domain/db/schema';

/** A full user row. */
export type User = typeof users.$inferSelect;

/** Current time as an ISO-8601 string (the format every timestamp column uses). */
function now(): string {
  return new Date().toISOString();
}

/**
 * Insert the user on first sign-in, or refresh their identity fields on
 * return. `google_sub` is the stable key; a name or picture Google did not
 * share this time is left as it was.
 */
export async function upsertUser(
  db: Database,
  input: Readonly<{
    google_sub: string;
    email: string;
    name?: string;
    picture?: string;
  }>,
): Promise<User> {
  const timestamp = now();
  // Only what was supplied is overwritten on return visits.
  const update: Partial<typeof users.$inferInsert> = {
    email: input.email,
    updated_at: timestamp,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.picture !== undefined ? { picture: input.picture } : {}),
  };

  const [row] = await db
    .insert(users)
    .values({
      google_sub: input.google_sub,
      email: input.email,
      name: input.name ?? null,
      picture: input.picture ?? null,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .onConflictDoUpdate({ target: users.google_sub, set: update })
    .returning();
  if (!row) {
    throw new Error('Saving the user returned no row');
  }
  return row;
}

/** Fetch a user by primary key. */
export async function getUserById(
  db: Database,
  id: number,
): Promise<User | undefined> {
  return db.query.users.findFirst({ where: eq(users.id, id) });
}

/**
 * The epoch the person's sessions must carry to be honoured, or undefined when
 * the account no longer exists. One small read, for callers that must check a
 * session is still valid but have no use for the rest of the row.
 */
export async function getSessionEpoch(
  db: Database,
  userId: number,
): Promise<number | undefined> {
  const [row] = await db
    .select({ epoch: users.session_epoch })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return row?.epoch;
}

/**
 * End every session the person has, on every device, by moving to the next
 * epoch: cookies issued under the old one stop being honoured at once.
 */
export async function bumpSessionEpoch(
  db: Database,
  userId: number,
): Promise<void> {
  await db
    .update(users)
    .set({ session_epoch: sql`${users.session_epoch} + 1`, updated_at: now() })
    .where(eq(users.id, userId));
}
