/**
 * @packageDocumentation
 *
 * What a repository's badge reads: the standing of the sites found in the
 * repository, from the columns the last checks left on `domains`, through
 * `idx_domains_repo`, so only those sites are read.
 */

import { eq } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { stateOf } from '@/domain/db/live';
import { domains } from '@/domain/db/schema';
import type { ScoredSite } from '@/domain/badge/score';

/** The sites of a repository, with how each stands. */
export async function sitesOfRepo(
  db: Database,
  repo: string,
  now = Date.now(),
): Promise<ScoredSite[]> {
  const rows = await db
    .select({
      checking_since: domains.checking_since,
      errors: domains.errors,
      warnings: domains.warnings,
      reachable: domains.reachable,
    })
    .from(domains)
    .where(eq(domains.repo, repo));
  return rows.map((row) => ({
    state: stateOf(row, now),
    errors: row.errors ?? 0,
    warnings: row.warnings ?? 0,
  }));
}
