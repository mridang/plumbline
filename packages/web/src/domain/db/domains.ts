/**
 * @packageDocumentation
 *
 * Repository for the `domains` table: the sites a person keeps an eye on, and
 * which checks they chose for each. Every query is scoped by the owner, so one
 * person can never read or change another's domain by guessing its id.
 */

import { and, asc, count, eq, inArray, isNotNull } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { domains } from '@/domain/db/schema';

/** A domain row as stored (`checks` is still JSON text). */
type DomainRow = typeof domains.$inferSelect;

/**
 * Where a site came from. Only `manual` is safe from pruning: the others are
 * dropped when the place they came from stops listing them.
 */
export type SiteSource = 'manual' | 'config' | 'deployment' | 'fallback';

/**
 * How much a source is trusted when two find the same site: a deployment is
 * proof the site is live, the file declares it, the Wrangler routes and the
 * Website field only suggest it, and a person's own choice beats them all.
 */
const SOURCE_RANK: Readonly<Record<SiteSource, number>> = {
  fallback: 0,
  config: 1,
  deployment: 2,
  manual: 3,
};

/** The sources a stored value may hold besides manual. */
const STORED_SOURCES: readonly SiteSource[] = [
  'config',
  'deployment',
  'fallback',
];

/** The origin of a domain added by hand. */
const MANUAL_ORIGIN: SiteOrigin = { source: 'manual' };

/** The sources a site can have, as a stored value is checked against. */
function sourceOf(value: string): SiteSource {
  return STORED_SOURCES.find((source) => source === value) ?? 'manual';
}

/** What found a site: the source, and for a deployment the environment that reported it. */
export interface SiteOrigin {
  readonly source: SiteSource;
  readonly environment?: string | null;
}

/** A domain with its chosen checks read out of the JSON column. */
export interface Domain {
  readonly id: string;
  readonly user_id: number;
  readonly host: string;
  /** The ids of the checks chosen for the domain, or null for every check. */
  readonly checks: readonly string[] | null;
  /** `owner/name` of the repository the domain was found in; null when added by hand. */
  readonly repo: string | null;
  /** Where the site came from; only a `manual` site is never dropped by a sync. */
  readonly source: SiteSource;
  /** The environment that reported a `deployment` site; null for the others. */
  readonly environment: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

/** How many domains one person may keep. */
export const MAX_DOMAINS = 50;

/** Current time as an ISO-8601 string (the format every timestamp column uses). */
function now(): string {
  return new Date().toISOString();
}

/** The chosen checks in a row: a list of strings, or null for all (anything unreadable counts as all). */
function checksOf(text: string | null): readonly string[] | null {
  if (text === null) {
    return null;
  }
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) &&
      value.every((id): id is string => typeof id === 'string')
      ? value
      : null;
  } catch {
    return null;
  }
}

/** A row as the rest of the app sees it. */
export function domainOf(
  row: Readonly<
    Pick<
      DomainRow,
      | 'id'
      | 'user_id'
      | 'host'
      | 'checks'
      | 'repo'
      | 'source'
      | 'environment'
      | 'created_at'
      | 'updated_at'
    >
  >,
): Domain {
  // Named one by one: what the last server check found is the dashboard's
  // business and is not part of a domain as the app and the API show it.
  return {
    id: row.id,
    user_id: row.user_id,
    host: row.host,
    checks: checksOf(row.checks),
    repo: row.repo,
    source: sourceOf(row.source),
    environment: row.environment,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/** The person's domains, oldest first. */
export async function listDomains(
  db: Database,
  userId: number,
): Promise<Domain[]> {
  const rows = await db
    .select()
    .from(domains)
    .where(eq(domains.user_id, userId))
    .orderBy(asc(domains.created_at), asc(domains.id));
  return rows.map((row) => domainOf(row));
}

/** How many domains the person keeps. */
export async function countDomains(
  db: Database,
  userId: number,
): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(domains)
    .where(eq(domains.user_id, userId));
  return row?.total ?? 0;
}

/** One of the person's domains by id, or undefined when they have none with it. */
export async function getDomain(
  db: Database,
  userId: number,
  id: string,
): Promise<Domain | undefined> {
  const [row] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.user_id, userId), eq(domains.id, id)))
    .limit(1);
  return row ? domainOf(row) : undefined;
}

/** One of the person's domains by host, or undefined. */
export async function findDomainByHost(
  db: Database,
  userId: number,
  host: string,
): Promise<Domain | undefined> {
  const [row] = await db
    .select()
    .from(domains)
    .where(and(eq(domains.user_id, userId), eq(domains.host, host)))
    .limit(1);
  return row ? domainOf(row) : undefined;
}

/** The person's domains that were found in the repository `owner/name`. */
export async function listDomainsOfRepo(
  db: Database,
  userId: number,
  repo: string,
): Promise<Domain[]> {
  const rows = await db
    .select()
    .from(domains)
    .where(and(eq(domains.user_id, userId), eq(domains.repo, repo)))
    .orderBy(asc(domains.host));
  return rows.map((row) => domainOf(row));
}

/**
 * Add a domain for the person, or return the one they already have for that
 * host (`created` says which). A new domain runs every check. `origin` says
 * what found it (a person, by default). A site that already exists keeps its
 * place on the dashboard, but learns its repository when it had none, and
 * takes a more trusted source over a less trusted one (a deployment's address
 * over a Wrangler route); a `manual` site stays manual.
 */
export async function addDomain(
  db: Database,
  userId: number,
  host: string,
  repo: string | null = null,
  origin: SiteOrigin = MANUAL_ORIGIN,
): Promise<{ readonly domain: Domain; readonly created: boolean }> {
  const timestamp = now();
  const environment =
    origin.source === 'deployment' ? (origin.environment ?? null) : null;
  const [row] = await db
    .insert(domains)
    .values({
      id: crypto.randomUUID(),
      user_id: userId,
      host,
      checks: null,
      repo,
      source: origin.source,
      environment,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .onConflictDoNothing()
    .returning();
  if (row) {
    return { domain: domainOf(row), created: true };
  }
  const existing = await findDomainByHost(db, userId, host);
  if (!existing) {
    throw new Error('Saving the domain returned no row');
  }
  // A domain added by hand that a repository turns out to serve learns its
  // repository, and one found in this repository takes the better source.
  const learns = repo !== null && existing.repo === null;
  const sameRepo = existing.repo === null || existing.repo === repo;
  const upgrades =
    repo !== null &&
    sameRepo &&
    SOURCE_RANK[origin.source] > SOURCE_RANK[existing.source] &&
    existing.source !== 'manual';
  if (!learns && !upgrades) {
    return { domain: existing, created: false };
  }
  const [changed] = await db
    .update(domains)
    .set({
      ...(learns ? { repo } : {}),
      ...(upgrades ? { source: origin.source, environment } : {}),
      updated_at: timestamp,
    })
    .where(and(eq(domains.user_id, userId), eq(domains.id, existing.id)))
    .returning();
  return { domain: changed ? domainOf(changed) : existing, created: false };
}

/**
 * Choose which checks run for one of the person's domains (null for every
 * check). The updated domain, or undefined when they have none with that id.
 */
export async function setDomainChecks(
  db: Database,
  userId: number,
  id: string,
  checks: readonly string[] | null,
): Promise<Domain | undefined> {
  const [row] = await db
    .update(domains)
    .set({
      checks: checks === null ? null : JSON.stringify(checks),
      updated_at: now(),
    })
    .where(and(eq(domains.user_id, userId), eq(domains.id, id)))
    .returning();
  return row ? domainOf(row) : undefined;
}

/** Remove one of the person's domains. True when there was one to remove. */
export async function deleteDomain(
  db: Database,
  userId: number,
  id: string,
): Promise<boolean> {
  const removed = await db
    .delete(domains)
    .where(and(eq(domains.user_id, userId), eq(domains.id, id)))
    .returning({ id: domains.id });
  return removed.length > 0;
}

/** How many repositories are removed per query (D1 allows 100 bound values). */
const REMOVE_BATCH = 50;

/**
 * Remove some of the person's sites by id, the way a site is removed
 * everywhere else: only the site goes. The runs and issues already recorded
 * stay, and the issues of a site the repository no longer deploys are closed
 * by the next run. Returns how many were removed.
 */
export async function deleteSites(
  db: Database,
  userId: number,
  ids: readonly string[],
): Promise<number> {
  let removed = 0;
  for (let at = 0; at < ids.length; at += REMOVE_BATCH) {
    const gone = await db
      .delete(domains)
      .where(
        and(
          eq(domains.user_id, userId),
          inArray(domains.id, ids.slice(at, at + REMOVE_BATCH)),
        ),
      )
      .returning({ id: domains.id });
    removed += gone.length;
  }
  return removed;
}

/**
 * Removes the person's sites of repositories that are not in `present`: a
 * repository that was deleted, or taken out of the app, leaves its sites
 * behind otherwise. Sites added by hand (no repository) stay. The runs and
 * issues already recorded are kept. Returns the repositories whose sites were
 * removed.
 */
export async function removeSitesOfMissingRepos(
  db: Database,
  userId: number,
  present: ReadonlySet<string>,
): Promise<string[]> {
  const rows = await db
    .selectDistinct({ repo: domains.repo })
    .from(domains)
    .where(and(eq(domains.user_id, userId), isNotNull(domains.repo)));
  const missing = rows
    .map((row) => row.repo)
    .filter((repo): repo is string => repo !== null && !present.has(repo));
  for (let at = 0; at < missing.length; at += REMOVE_BATCH) {
    await db
      .delete(domains)
      .where(
        and(
          eq(domains.user_id, userId),
          inArray(domains.repo, missing.slice(at, at + REMOVE_BATCH)),
        ),
      );
  }
  return missing;
}
