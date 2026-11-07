/**
 * @packageDocumentation
 *
 * Which sites a repository has, and where each came from. Four places can name
 * a site, and they are not equal:
 *
 * 1. a person adds it by hand (`manual`), and nothing ever removes it;
 * 2. a successful deployment reports its address as `environment_url`
 *    (`deployment`): proof that something is live there;
 * 3. the repository's `plumbline.yaml` lists it under `sites` (`config`);
 * 4. the Wrangler routes or the Website field suggest it (`fallback`), which
 *    is used only while neither 2 nor 3 has named a site, because a stale
 *    Website field is the usual way a dead address ends up on the dashboard.
 *
 * A repository's sites are those of 2 and 3 together, else those of 4. Each
 * site records its source, so a site is dropped when the place it came from
 * stops listing it: a file that no longer declares an address, a deployment
 * environment that now reports another address, a fallback once a real source
 * exists. This is the only place that adds or drops a repository's sites.
 */

import type { Database } from '@/domain/db/client';
import {
  addDomain,
  countDomains,
  deleteSites,
  findDomainByHost,
  listDomainsOfRepo,
  MAX_DOMAINS,
  type Domain,
} from '@/domain/db/domains';

/** What is known about a repository's sites right now. */
export interface KnownSites {
  /**
   * The hosts the repository's file declares, or null when the file could not
   * be read (the sites it declared before are left alone).
   */
  readonly declared?: readonly string[] | null;
  /**
   * The hosts the Wrangler routes and the Website field suggest, or null when
   * they were not read (the fallback sites found before are left alone).
   */
  readonly fallback?: readonly string[] | null;
  /** The address a successful deployment of one environment just reported. */
  readonly deployed?: { readonly environment: string; readonly host: string };
}

/** What changed. */
export interface SiteChanges {
  /** Sites newly added. */
  readonly added: readonly string[];
  /** Sites dropped because their source no longer lists them. */
  readonly removed: readonly string[];
}

/** Whether a site is one a deployment or the file named, which outranks a fallback. */
export function isReal(site: Readonly<Domain>): boolean {
  return site.source === 'config' || site.source === 'deployment';
}

/**
 * Brings the person's sites of `repo` in line with what is known: adds what the
 * sources name and drops what they no longer list. Never touches a `manual`
 * site, and never adds more than the person may keep.
 */
export async function reconcileSites(
  db: Database,
  userId: number,
  repo: string,
  known: Readonly<KnownSites>,
): Promise<SiteChanges> {
  const added: string[] = [];
  const removed: string[] = [];
  let room = MAX_DOMAINS - (await countDomains(db, userId));

  const add = async (
    host: string,
    origin: Parameters<typeof addDomain>[4],
  ): Promise<void> => {
    // A site the person already has costs nothing, so it is still tagged.
    if (room <= 0 && !(await findDomainByHost(db, userId, host))) {
      return;
    }
    const { created } = await addDomain(db, userId, host, repo, origin);
    if (created) {
      added.push(host);
      room -= 1;
    }
  };
  const drop = async (sites: readonly Domain[]): Promise<void> => {
    await deleteSites(
      db,
      userId,
      sites.map((site) => site.id),
    );
    removed.push(...sites.map((site) => site.host));
  };

  const before = await listDomainsOfRepo(db, userId, repo);
  const declared = known.declared ?? null;
  if (declared !== null) {
    for (const host of declared) {
      await add(host, { source: 'config' });
    }
    await drop(
      before.filter(
        (site) => site.source === 'config' && !declared.includes(site.host),
      ),
    );
  }
  if (known.deployed) {
    const { environment, host } = known.deployed;
    await add(host, { source: 'deployment', environment });
    // The environment now reports another address; the old one is not live.
    await drop(
      before.filter(
        (site) =>
          site.source === 'deployment' &&
          site.environment === environment &&
          site.host !== host &&
          !(declared ?? []).includes(site.host),
      ),
    );
  }

  const now = await listDomainsOfRepo(db, userId, repo);
  if (now.some(isReal)) {
    await drop(now.filter((site) => site.source === 'fallback'));
  } else if (known.fallback) {
    for (const host of known.fallback) {
      await add(host, { source: 'fallback' });
    }
    await drop(
      now.filter(
        (site) =>
          site.source === 'fallback' && !known.fallback?.includes(site.host),
      ),
    );
  }
  return { added, removed };
}
