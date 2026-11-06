import { describe, expect, it, jest } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { isRepoDisabled } from '@/domain/db/disabled';
import { addDomain } from '@/domain/db/domains';
import { saveRepos } from '@/domain/db/github';
import { markChecking } from '@/domain/db/live';
import { issuesOfHost, saveIssue } from '@/domain/db/suite';
import { readGitHubConfig } from '@/domain/github/config';
import { closeIssuesOfDisabled, pauseRepo } from '@/domain/suite/disable';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';
import { GITHUB_ENV } from '../github/github-test-kit';

const config = readGitHubConfig(GITHUB_ENV)!;

/** A GitHub that answers every request and remembers them. */
function github() {
  const calls: string[] = [];
  const fetcher = (async (input: unknown, init?: RequestInit) => {
    const path = String(input).replace('https://api.github.com', '');
    calls.push(`${init?.method ?? 'GET'} ${path}`);
    return path.endsWith('/access_tokens')
      ? Response.json({ token: 'ghs_1' })
      : Response.json({ number: 12, state: 'closed' });
  }) as typeof fetch;
  return { fetcher, calls };
}

const setup = async () => {
  const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
  await addDomain(db, 7, 'site.test', 'acme/site');
  await saveRepos(db, 7, 5, [
    { full_name: 'acme/site', default_branch: 'main', hosts: ['site.test'] },
  ]);
  for (const [check, number] of [
    ['seo-viewport', 12],
    ['seo-links', 13],
  ] as const) {
    await saveIssue(db, 'acme/site', 'site.test', check, {
      number,
      state: 'open',
      signature: 'sig',
      reopens: 0,
    });
  }
  return db;
};

const now = () => new Date('2026-01-01T00:00:00.000Z');

describe('pauseRepo', () => {
  it('stores the flag before anything else, and hands the closing to the background', async () => {
    const db = await setup();
    const { fetcher, calls } = github();
    const jobs: Promise<unknown>[] = [];
    await markChecking(db, 7, 'site.test', now().toISOString());
    await pauseRepo(db, 7, 'acme/site', {
      config,
      fetcher,
      now,
      pause: async () => undefined,
      background: (work) => jobs.push(work),
    });
    expect(await isRepoDisabled(db, 'acme/site')).toBe(true);
    expect(calls).toEqual([]);
    expect(jobs).toHaveLength(1);
    await Promise.all(jobs);
    expect(calls.filter((c) => c.startsWith('PATCH')).toSorted()).toEqual([
      'PATCH /repos/acme/site/issues/12',
      'PATCH /repos/acme/site/issues/13',
    ]);
    expect(
      calls.filter((c) => c.startsWith('POST') && c.endsWith('/comments')),
    ).toHaveLength(2);
  });

  it('closes the issues without opening or editing anything else', async () => {
    const db = await setup();
    const { fetcher, calls } = github();
    await closeIssuesOfDisabled(db, 'acme/site', {
      config,
      fetcher,
      pause: async () => undefined,
    });
    expect(calls.filter((c) => /check-runs|issues$/.test(c))).toEqual([]);
    expect(
      [...(await issuesOfHost(db, 'acme/site', 'site.test')).values()].map(
        (issue) => issue.state,
      ),
    ).toEqual(['fixed', 'fixed']);
  });

  it('does nothing more when the checks were already off', async () => {
    const db = await setup();
    const { fetcher } = github();
    const jobs: Promise<unknown>[] = [];
    const deps = {
      config,
      fetcher,
      now,
      pause: async () => undefined,
      background: (work: Promise<unknown>) => jobs.push(work),
    };
    await pauseRepo(db, 7, 'acme/site', deps);
    await pauseRepo(db, 7, 'acme/site', deps);
    expect(jobs).toHaveLength(1);
  });

  it('still turns checks off when GitHub is not set up or does not know the repository', async () => {
    const db = await setup();
    const { fetcher, calls } = github();
    await closeIssuesOfDisabled(db, 'acme/site', { config: null, fetcher });
    await closeIssuesOfDisabled(db, 'acme/unknown', { config, fetcher });
    expect(calls).toEqual([]);
  });

  it('logs a failure to close and does not throw', async () => {
    const db = await setup();
    const failing = (async () =>
      new Response('no', { status: 500 })) as typeof fetch;
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await expect(
      closeIssuesOfDisabled(db, 'acme/site', { config, fetcher: failing }),
    ).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});
