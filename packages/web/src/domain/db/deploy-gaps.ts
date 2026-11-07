/**
 * @packageDocumentation
 *
 * The environments of a repository whose latest successful deployment reported
 * no usable address. A deployment without an address cannot name a site, so the
 * repository page says so and how to fix it; the note goes as soon as that
 * environment reports an address. One row for each repository and environment.
 */

import { and, asc, eq } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { deployUrlGaps } from '@/domain/db/schema';

/** Note that the environment's latest deployment reported no address. */
export async function noteGap(
  db: Database,
  repo: string,
  environment: string,
  timestamp = new Date().toISOString(),
): Promise<void> {
  await db
    .insert(deployUrlGaps)
    .values({ repo, environment, seen_at: timestamp })
    .onConflictDoUpdate({
      target: [deployUrlGaps.repo, deployUrlGaps.environment],
      set: { seen_at: timestamp },
    });
}

/** Forget the note: the environment reported an address. */
export async function clearGap(
  db: Database,
  repo: string,
  environment: string,
): Promise<void> {
  await db
    .delete(deployUrlGaps)
    .where(
      and(
        eq(deployUrlGaps.repo, repo),
        eq(deployUrlGaps.environment, environment),
      ),
    );
}

/** The environments of the repository that reported no address, by name. */
export async function listGaps(db: Database, repo: string): Promise<string[]> {
  const rows = await db
    .select({ environment: deployUrlGaps.environment })
    .from(deployUrlGaps)
    .where(eq(deployUrlGaps.repo, repo))
    .orderBy(asc(deployUrlGaps.environment));
  return rows.map((row) => row.environment);
}
