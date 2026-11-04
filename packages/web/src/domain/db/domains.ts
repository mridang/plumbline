/**
 * @packageDocumentation
 *
 * Repository for the `domains` table: the sites a person keeps an eye on, and
 * which checks they chose for each. Every query is scoped by the owner, so one
 * person can never read or change another's domain by guessing its id.
 */

import { and, asc, count, eq } from 'drizzle-orm';

import type { Database } from '@/domain/db/client';
import { domains } from '@/domain/db/schema';

/** A domain row as stored (`checks` is still JSON text). */
type DomainRow = typeof domains.$inferSelect;

/** A domain with its chosen checks read out of the JSON column. */
export interface Domain {
  readonly id: string;
  readonly user_id: number;
  readonly host: string;
  /** The ids of the checks chosen for the domain, or null for every check. */
  readonly checks: readonly string[] | null;
  /** `owner/name` of the repository the domain was found in; null when added by hand. */
  readonly repo: string | null;
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
  return rows.map(domainOf);
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
  return rows.map(domainOf);
}

/**
 * Add a domain for the person, or return the one they already have for that
 * host (`created` says which). A new domain runs every check.
 */
export async function addDomain(
  db: Database,
  userId: number,
  host: string,
  repo: string | null = null,
): Promise<{ readonly domain: Domain; readonly created: boolean }> {
  const timestamp = now();
  const [row] = await db
    .insert(domains)
    .values({
      id: crypto.randomUUID(),
      user_id: userId,
      host,
      checks: null,
      repo,
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
  // A domain added by hand that a repository turns out to serve learns its repository.
  if (repo !== null && existing.repo === null) {
    const [tagged] = await db
      .update(domains)
      .set({ repo, updated_at: timestamp })
      .where(and(eq(domains.user_id, userId), eq(domains.id, existing.id)))
      .returning();
    return { domain: tagged ? domainOf(tagged) : existing, created: false };
  }
  return { domain: existing, created: false };
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
