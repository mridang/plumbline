import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { getPreviewReport } from '@/domain/db/preview-reports';
import { CHECKS } from '@/domain/checks/catalogue';
import { addDomain, deleteDomain } from '@/domain/db/domains';
import { forgetIssue, issueOf, latestRuns } from '@/domain/db/suite';
import { GitHubApi } from '@/domain/github/api';
import { readGitHubConfig } from '@/domain/github/config';
import type { Deployment } from '@/domain/suite/deploy';
import {
  CONFIG_MAX_BYTES,
  handleDeployment,
  loadConfig,
} from '@/domain/suite/github-run';
import { MAX_NEW_ISSUES } from '@/domain/suite/publish';
import type { SuiteRun } from '@/domain/suite/run';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';
import { GITHUB_ENV } from '../github/github-test-kit';

const config = readGitHubConfig(GITHUB_ENV)!;

interface Call {
  method: string;
  path: string;
  body: Record<string, unknown>;
}

/**
 * A GitHub that records its requests. \`files\` are the repository's files by
 * name (a number is the status to answer with instead); anything else about a
 * file is a 404. \`fail\` makes the requests whose address contains it answer
 * with that status.
 */
function github(
  files: Record<string, string | number> = {},
  fail: Record<string, number> = {},
) {
  const calls: Call[] = [];
  const fetcher = (async (input: unknown, init?: RequestInit) => {
    const path = String(input).replace('https://api.github.com', '');
    const method = init?.method ?? 'GET';
    calls.push({
      method,
      path,
      body: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>,
    });
    const failing = Object.keys(fail).find((part) => path.includes(part));
    if (failing) {
      return new Response('no', { status: fail[failing] });
    }
    if (path.endsWith('/access_tokens')) {
      return Response.json({ token: 'ghs_1' });
    }
    const file = /\/contents\/([^?]+)\?ref=(.+)$/.exec(path);
    if (file) {
      const content = files[decodeURIComponent(file[1]!)];
      return typeof content === 'string'
        ? new Response(content)
        : new Response('no', { status: content ?? 404 });
    }
    if (path.endsWith('/check-runs')) {
      return Response.json({ id: 1 });
    }
    return Response.json({ number: 21, state: 'open' });
  }) as typeof fetch;
  return { fetcher, calls };
}

/** A run that found an error in the rule \`id\`. */
const failing =
  (id = 'seo-viewport', severity: 'error' | 'warning' = 'error') =>
  async (): Promise<SuiteRun> => ({
    url: 'https://site.test/',
    status: 200,
    hash: 'h',
    checks: [{ id, findings: [{ severity, message: 'it is wrong' }] }],
    skipped: [],
  });

const live: Deployment = {
  environment: 'production',
  repo: 'acme/site',
  sha: 'abc1234',
  url: null,
};
const preview: Deployment = {
  environment: 'preview',
  repo: 'acme/site',
  sha: 'abc1234',
  url: 'https://pr-3.site.test/',
};

const setup = async () => {
  const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
  await addDomain(db, 7, 'site.test', 'acme/site');
  return db;
};

/** Runs a deployment without the pause between writes to GitHub. */
const deploy = (
  db: Parameters<typeof handleDeployment>[0],
  cfg: Parameters<typeof handleDeployment>[1],
  installation: number,
  user: number,
  deployed: Deployment,
  deps: Parameters<typeof handleDeployment>[5] = {},
) =>
  handleDeployment(db, cfg, installation, user, deployed, {
    pause: async () => undefined,
    ...deps,
  });

const paths = (calls: Call[]) => calls.map((c) => `${c.method} ${c.path}`);

afterEach(() => {
  jest.restoreAllMocks();
});

describe('loadConfig', () => {
  const api = (files: Record<string, string | number>) =>
    new GitHubApi('t', github(files).fetcher);

  it('reads the first configuration file the repository has, at the commit', async () => {
    const { fetcher, calls } = github({ 'plumbline.yml': 'issues: off\n' });
    const result = await loadConfig(
      new GitHubApi('t', fetcher),
      'acme/site',
      'abc',
    );
    expect(result.loaded).toMatchObject({
      path: 'plumbline.yml',
      issues: 'off',
    });
    expect(result.unreadable).toBeNull();
    expect(paths(calls)).toEqual([
      'GET /repos/acme/site/contents/plumbline.yaml?ref=abc',
      'GET /repos/acme/site/contents/plumbline.yml?ref=abc',
    ]);
  });

  it('finds nothing and no problem in a repository with no file', async () => {
    expect(await loadConfig(api({}), 'acme/site', 'abc')).toEqual({
      loaded: null,
      unreadable: null,
    });
  });

  it('says so when GitHub fails in another way', async () => {
    const result = await loadConfig(
      api({ 'plumbline.yaml': 500 }),
      'acme/site',
      'abc',
    );
    expect(result.loaded).toBeNull();
    expect(result.unreadable).toMatch(
      /^plumbline\.yaml could not be read from GitHub/,
    );
  });
});

describe('loadConfig, a file that is too long', () => {
  it('is ignored with a sentence that says why', async () => {
    const huge = '# ' + 'x'.repeat(CONFIG_MAX_BYTES + 10);
    const { fetcher } = github({ 'plumbline.yaml': huge });
    const result = await loadConfig(
      new GitHubApi('t', fetcher),
      'acme/site',
      'abc',
    );
    expect(result.loaded).toBeNull();
    expect(result.unreadable).toBe(
      'plumbline.yaml is longer than 32 KB, so it was ignored and the default rules were used.',
    );
  });
});

describe('handleDeployment of the live site', () => {
  it('checks the site under the recommended rules and opens an issue for its errors', async () => {
    const db = await setup();
    const { fetcher, calls } = github();
    await deploy(db, config, 5, 7, live, { fetcher, run: failing() });
    expect(paths(calls)).toEqual([
      'POST /app/installations/5/access_tokens',
      'GET /repos/acme/site/contents/plumbline.yaml?ref=abc1234',
      'GET /repos/acme/site/contents/plumbline.yml?ref=abc1234',
      'GET /repos/acme/site/contents/plumbline.json?ref=abc1234',
      'POST /repos/acme/site/issues',
    ]);
    expect(calls[4]?.body['title']).toMatch(/^\[Plumbline\] .+ on site\.test$/);
    expect(String(calls[4]?.body['body'])).toContain(
      '`plumbline:recommended` rules were used',
    );
    expect(
      await issueOf(db, 'acme/site', 'site.test', 'seo-viewport'),
    ).toMatchObject({
      number: 21,
      state: 'open',
    });
    expect((await latestRuns(db, 7, 'site.test'))[0]?.findings).toHaveLength(1);
  });

  it('applies the rules of the repository file, and says where they came from', async () => {
    const db = await setup();
    const { fetcher, calls } = github({
      'plumbline.yaml':
        'rules:\n  seo-viewport: off\n  seo-links: error\n  dnssec-valid: error\n',
    });
    await deploy(db, config, 5, 7, live, {
      fetcher,
      run: async () => ({
        url: 'https://site.test/',
        status: 200,
        hash: 'h',
        checks: [
          {
            id: 'seo-viewport',
            findings: [{ severity: 'error', message: 'viewport' }],
          },
          {
            id: 'seo-links',
            findings: [{ severity: 'hint', message: 'links' }],
          },
          {
            id: 'dnssec-valid',
            findings: [{ severity: 'warning', message: 'not signed' }],
          },
        ],
        skipped: [],
      }),
    });
    const issues = calls.filter(
      (c) => c.method === 'POST' && c.path.endsWith('/issues'),
    );
    // One issue for each check the rules ask for; the one they turned off has none.
    expect(issues.map((c) => String(c.body['body']).split('\n')[0])).toEqual([
      '<!-- plumbline:site.test:seo-links -->',
      '<!-- plumbline:site.test:dnssec-valid -->',
    ]);
    const [links, dns] = issues.map((c) => String(c.body['body']));
    expect(links).toContain('**error**: links');
    expect(links).toContain('Rules from `plumbline.yaml`.');
    // A check the server could not run before (DNS) now counts like any other.
    expect(dns).toContain('**error**: not signed');
    expect(
      issues.some((c) => String(c.body['body']).includes('viewport')),
    ).toBe(false);
  });

  it('opens no issue when the file says issues are off', async () => {
    const db = await setup();
    const { fetcher, calls } = github({ 'plumbline.yaml': 'issues: off\n' });
    await deploy(db, config, 5, 7, live, { fetcher, run: failing() });
    expect(calls.some((c) => c.path.endsWith('/issues'))).toBe(false);
    expect((await latestRuns(db, 7, 'site.test'))[0]?.findings).toHaveLength(1);
  });

  it('reports the mistakes in the file on the issue', async () => {
    const db = await setup();
    const { fetcher, calls } = github({
      'plumbline.yaml': 'rules:\n  nope: error\n',
    });
    await deploy(db, config, 5, 7, live, { fetcher, run: failing() });
    const issue = calls.find((c) => c.path.endsWith('/issues'));
    expect(String(issue?.body['body'])).toContain(
      'Unknown rule "nope" in plumbline.yaml.',
    );
  });

  it('uses the default rules, and says so, when the file cannot be read', async () => {
    const db = await setup();
    const { fetcher, calls } = github({ 'plumbline.yaml': 500 });
    await deploy(db, config, 5, 7, live, { fetcher, run: failing() });
    const issue = calls.find((c) => c.path.endsWith('/issues'));
    expect(String(issue?.body['body'])).toContain(
      'could not be read from GitHub',
    );
  });

  it('still checks the site, and opens no issue, when GitHub will not give a token', async () => {
    const db = await setup();
    const { fetcher, calls } = github({}, { '/access_tokens': 401 });
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await deploy(db, config, 5, 7, live, { fetcher, run: failing() });
    expect(paths(calls)).toEqual(['POST /app/installations/5/access_tokens']);
    expect(error).toHaveBeenCalled();
    expect(await latestRuns(db, 7, 'site.test')).toHaveLength(1);
  });

  it('says nothing about a site whose page and rules have not changed', async () => {
    const db = await setup();
    const first = github();
    await deploy(db, config, 5, 7, live, {
      fetcher: first.fetcher,
      run: failing(),
    });
    const second = github();
    await deploy(db, config, 5, 7, live, {
      fetcher: second.fetcher,
      now: () => new Date(Date.now() + 3_600_000),
      run: failing(),
    });
    expect(second.calls.some((c) => c.path.includes('/issues'))).toBe(false);
  });

  it('closes the issue when a later deployment has fixed the problems', async () => {
    const db = await setup();
    await deploy(db, config, 5, 7, live, {
      fetcher: github().fetcher,
      run: failing(),
    });
    const later = github();
    await deploy(
      db,
      config,
      5,
      7,
      { ...live, sha: 'fix5678' },
      {
        fetcher: later.fetcher,
        now: () => new Date(Date.now() + 3_600_000),
        run: async () => ({
          url: 'https://site.test/',
          status: 200,
          hash: 'fixed',
          checks: [],
          skipped: [],
        }),
      },
    );
    expect(later.calls.find((c) => c.method === 'PATCH')).toMatchObject({
      path: '/repos/acme/site/issues/21',
      body: { state: 'closed' },
    });
    expect(later.calls.at(-1)?.path).toBe(
      '/repos/acme/site/issues/21/comments',
    );
    expect(
      (await issueOf(db, 'acme/site', 'site.test', 'seo-viewport'))?.state,
    ).toBe('fixed');
  });

  it('opens the issue again for a site that looks the same when a person deleted it', async () => {
    const db = await setup();
    await deploy(db, config, 5, 7, live, {
      fetcher: github().fetcher,
      run: failing(),
    });
    await forgetIssue(db, 'acme/site', 21);
    const later = github();
    await deploy(
      db,
      config,
      5,
      7,
      { ...live, sha: 'fix5678' },
      {
        fetcher: later.fetcher,
        now: () => new Date(Date.now() + 3_600_000),
        run: failing(),
      },
    );
    expect(
      later.calls.filter(
        (c) => c.method === 'POST' && c.path.endsWith('/issues'),
      ),
    ).toHaveLength(1);
  });

  it('looks up the pull request once for all the sites it closes issues for', async () => {
    const db = await setup();
    await addDomain(db, 7, 'other.test', 'acme/site');
    await deploy(db, config, 5, 7, live, {
      fetcher: github().fetcher,
      run: failing(),
    });
    const later = github();
    await deploy(
      db,
      config,
      5,
      7,
      { ...live, sha: 'fix5678' },
      {
        fetcher: later.fetcher,
        now: () => new Date(Date.now() + 3_600_000),
        run: async () => ({
          url: 'https://site.test/',
          status: 200,
          hash: 'fixed',
          checks: [],
          skipped: [],
        }),
      },
    );
    expect(later.calls.filter((c) => c.path.endsWith('/pulls'))).toHaveLength(
      1,
    );
    expect(later.calls.filter((c) => c.method === 'PATCH')).toHaveLength(2);
  });

  it('logs a failure to update the issue and does not throw', async () => {
    const db = await setup();
    const { fetcher } = github({}, { '/issues': 403 });
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await expect(
      deploy(db, config, 5, 7, live, { fetcher, run: failing() }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      'issue sync failed',
      'acme/site',
      'site.test',
      expect.anything(),
    );
  });
});

describe('handleDeployment, the life of the issues', () => {
  const later = (sha: string) => ({
    now: () => new Date(Date.now() + 3_600_000),
    sha,
  });

  it('closes the issue of a check the repository then turns off, and says the rules did it', async () => {
    const db = await setup();
    await deploy(db, config, 5, 7, live, {
      fetcher: github().fetcher,
      run: failing(),
    });
    const next = github({ 'plumbline.yaml': 'rules:\n  seo-viewport: off\n' });
    await deploy(
      db,
      config,
      5,
      7,
      { ...live, sha: 'rules99' },
      { fetcher: next.fetcher, now: later('').now, run: failing() },
    );
    expect(next.calls.find((c) => c.method === 'PATCH')).toMatchObject({
      path: '/repos/acme/site/issues/21',
      body: { state: 'closed', state_reason: 'not_planned' },
    });
    const note = next.calls.find((c) => c.path.endsWith('/comments'));
    expect(String(note?.body['body'])).toContain('turned off by the rules');
    expect(String(note?.body['body'])).toContain(
      '[`plumbline.yaml`](https://github.com/acme/site/blob/rules99/plumbline.yaml)',
    );
    expect(
      (await issueOf(db, 'acme/site', 'site.test', 'seo-viewport'))?.state,
    ).toBe('fixed');
  });

  it('closes the issues of a site the repository no longer deploys', async () => {
    const db = await setup();
    const other = await addDomain(db, 7, 'other.test', 'acme/site');
    await deploy(db, config, 5, 7, live, {
      fetcher: github().fetcher,
      run: failing(),
    });
    expect(
      (await issueOf(db, 'acme/site', 'other.test', 'seo-viewport'))?.state,
    ).toBe('open');
    await deleteDomain(db, 7, other.domain.id);
    const next = github();
    await deploy(
      db,
      config,
      5,
      7,
      { ...live, sha: 'drop456' },
      { fetcher: next.fetcher, now: later('').now, run: failing() },
    );
    expect(
      (await issueOf(db, 'acme/site', 'other.test', 'seo-viewport'))?.state,
    ).toBe('fixed');
    expect(
      (await issueOf(db, 'acme/site', 'site.test', 'seo-viewport'))?.state,
    ).toBe('open');
    expect(
      next.calls.find((c) => c.path.endsWith('/comments'))?.body['body'],
    ).toContain('other.test is no longer deployed from this repository');
  });

  it('opens an issue for each check on each site of a monorepo', async () => {
    const db = await setup();
    await addDomain(db, 7, 'other.test', 'acme/site');
    const { fetcher, calls } = github();
    await deploy(db, config, 5, 7, live, { fetcher, run: failing() });
    const opened = calls.filter(
      (c) => c.method === 'POST' && c.path.endsWith('/issues'),
    );
    expect(
      opened.map((c) => String(c.body['body']).split('\n')[0]).toSorted(),
    ).toEqual([
      '<!-- plumbline:other.test:seo-viewport -->',
      '<!-- plumbline:site.test:seo-viewport -->',
    ]);
  });

  it('opens a few issues on a first run with many problems, and says more will follow', async () => {
    const db = await setup();
    const ids = CHECKS.slice(0, MAX_NEW_ISSUES + 4).map((check) => check.id);
    const { fetcher, calls } = github({
      'plumbline.yaml': `rules:\n${ids.map((id) => `  ${id}: error`).join('\n')}\n`,
    });
    await deploy(db, config, 5, 7, live, {
      fetcher,
      run: async () => ({
        url: 'https://site.test/',
        status: 200,
        hash: 'h',
        checks: ids.map((id) => ({
          id,
          findings: [{ severity: 'error' as const, message: `${id} fails` }],
        })),
        skipped: [],
      }),
    });
    expect(
      calls.filter((c) => c.method === 'POST' && c.path.endsWith('/issues')),
    ).toHaveLength(MAX_NEW_ISSUES);
    const note = calls.find((c) => c.path.endsWith('/comments'));
    expect(String(note?.body['body'])).toContain('4 more problems than');
  });

  it('pauses between its writes to GitHub unless told not to', async () => {
    const db = await setup();
    const pause = jest.fn(async () => undefined);
    await handleDeployment(db, config, 5, 7, live, {
      fetcher: github().fetcher,
      run: failing(),
      pause,
    });
    expect(pause).toHaveBeenCalled();
  });

  it('logs a failure to tidy up the issues and does not throw', async () => {
    const db = await setup();
    await deploy(db, config, 5, 7, live, {
      fetcher: github().fetcher,
      run: failing(),
    });
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await addDomain(db, 7, 'gone.test', 'acme/site');
    const next = github({}, { '/issues/21': 403 });
    await expect(
      deploy(
        db,
        config,
        5,
        7,
        { ...live, sha: 'next789' },
        {
          fetcher: next.fetcher,
          now: later('').now,
          run: failing('seo-links'),
        },
      ),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });
});

describe('handleDeployment, telling the repository', () => {
  const asks = { 'plumbline.yaml': 'dispatch: true\n' };

  it('sends repository_dispatch events for the live site when the file asks for them', async () => {
    const db = await setup();
    const { fetcher, calls } = github(asks);
    await deploy(db, config, 5, 7, live, { fetcher, run: failing() });
    const sent = calls.filter((c) => c.path.endsWith('/dispatches'));
    expect(sent.map((c) => c.body['event_type'])).toEqual([
      'plumbline.checked',
      'plumbline.failed',
    ]);
    expect(sent[0]?.body['client_payload']).toMatchObject({
      environment: 'production',
      host: 'site.test',
      errors: 1,
    });
  });

  it('sends them for a preview too', async () => {
    const db = await setup();
    const { fetcher, calls } = github(asks);
    await deploy(db, config, 5, 7, preview, {
      fetcher,
      run: failing(),
    });
    const sent = calls.filter((c) => c.path.endsWith('/dispatches'));
    expect(sent[0]?.body['client_payload']).toMatchObject({
      environment: 'preview',
      url: 'https://pr-3.site.test/',
    });
  });

  it('sends nothing unless the file asks', async () => {
    const db = await setup();
    const { fetcher, calls } = github();
    await deploy(db, config, 5, 7, live, { fetcher, run: failing() });
    expect(calls.some((c) => c.path.endsWith('/dispatches'))).toBe(false);
  });

  it('still reports the run when the repository will not take the event', async () => {
    const db = await setup();
    const { fetcher, calls } = github(asks, { '/dispatches': 403 });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    await deploy(db, config, 5, 7, live, { fetcher, run: failing() });
    expect(calls.some((c) => c.path.endsWith('/issues'))).toBe(true);
  });
});

describe('a forced check', () => {
  it('checks a site again a moment after the last check, which an ordinary check would not', async () => {
    const db = await setup();
    let runs = 0;
    const run = async () => {
      runs += 1;
      return failing()();
    };
    const first = github();
    await deploy(db, config, 5, 7, live, {
      fetcher: first.fetcher,
      run,
    });
    await deploy(db, config, 5, 7, live, {
      fetcher: github().fetcher,
      run,
    });
    expect(runs).toBe(1);
    await deploy(db, config, 5, 7, live, {
      fetcher: github().fetcher,
      run,
      force: true,
    });
    expect(runs).toBe(2);
  });
});

describe('handleDeployment of a preview', () => {
  it('checks the address of the deployment and reports it on the commit', async () => {
    const db = await setup();
    const { fetcher, calls } = github();
    const urls: string[] = [];
    await deploy(db, config, 5, 7, preview, {
      fetcher,
      run: async (url) => {
        urls.push(url);
        return failing()();
      },
    });
    expect(urls).toEqual(['https://pr-3.site.test/']);
    const check = calls.at(-1);
    expect(check).toMatchObject({
      method: 'POST',
      path: '/repos/acme/site/check-runs',
      body: {
        name: 'Plumbline',
        head_sha: 'abc1234',
        conclusion: 'failure',
        details_url: 'https://pr-3.site.test/',
      },
    });
  });

  it('keeps the report and links it from the check, so no sign-in is needed to read it', async () => {
    const db = await setup();
    const { fetcher, calls } = github();
    await deploy(db, config, 5, 7, preview, {
      fetcher,
      run: failing(),
      appUrl: 'https://plumbline.test',
    });
    const check = calls.at(-1);
    const link = String(check?.body['details_url']);
    expect(link).toMatch(/^https:\/\/plumbline\.test\/r\/[0-9a-f-]{36}$/);
    const id = link.split('/').pop()!;
    expect(check?.body['external_id']).toBe(id);
    expect(await getPreviewReport(db, id)).toMatchObject({
      repo: 'acme/site',
      sha: 'abc1234',
      errors: 1,
    });
    expect(String((check?.body['output'] as { text: string }).text)).toContain(
      `https://plumbline.test/api/previews/${id}`,
    );
  });

  it('checks a commit of a preview once, however often its deployment is reported', async () => {
    const db = await setup();
    const { fetcher, calls } = github();
    let runs = 0;
    const run = async () => {
      runs += 1;
      return failing()();
    };
    const deps = { fetcher, run, appUrl: 'https://plumbline.test' };
    await deploy(db, config, 5, 7, preview, deps);
    await deploy(db, config, 5, 7, preview, deps);
    expect(runs).toBe(1);
    expect(calls.filter((c) => c.path.endsWith('/check-runs'))).toHaveLength(1);
    await deploy(db, config, 5, 7, { ...preview, sha: 'def5678' }, deps);
    expect(runs).toBe(2);
    await deploy(db, config, 5, 7, preview, { ...deps, force: true });
    expect(runs).toBe(3);
  });

  it('links the preview and keeps nothing when the app does not know its own address', async () => {
    const db = await setup();
    const { fetcher, calls } = github();
    await deploy(db, config, 5, 7, preview, {
      fetcher,
      run: failing(),
    });
    expect(calls.at(-1)?.body['details_url']).toBe('https://pr-3.site.test/');
  });

  it('keeps the registered sites and their stored runs out of it', async () => {
    const db = await setup();
    await deploy(db, config, 5, 7, preview, {
      fetcher: github().fetcher,
      run: failing(),
    });
    expect(await latestRuns(db, 7, 'site.test')).toEqual([]);
    expect(await latestRuns(db, 7, 'pr-3.site.test')).toEqual([]);
  });

  it('opens no issue, whatever it finds', async () => {
    const { fetcher, calls } = github();
    await deploy(await setup(), config, 5, 7, preview, {
      fetcher,
      run: failing(),
    });
    expect(calls.some((c) => c.path.endsWith('/issues'))).toBe(false);
  });

  it('uses the preview rules of the file', async () => {
    const { fetcher, calls } = github({
      'plumbline.yaml':
        'environments:\n  preview:\n    rules:\n      seo-viewport: off\n      dnssec-valid: error\n',
    });
    await deploy(await setup(), config, 5, 7, preview, {
      fetcher,
      run: failing('dnssec-valid', 'warning'),
    });
    const check = calls.at(-1);
    expect(check?.body['conclusion']).toBe('failure');
    const summary = String(
      (check?.body['output'] as { summary: string }).summary,
    );
    // A DNS check, which the server could not make before, is reported at the level the file gives it.
    expect(summary).toContain('- **error**: it is wrong');
    expect(summary).toContain('Rules from `plumbline.yaml`.');
  });

  it('uses the production rules for the live site and the preview rules for the preview', async () => {
    const files = {
      'plumbline.yaml':
        'environments:\n  preview:\n    rules:\n      seo-viewport: off\n',
    };
    const liveCalls = github(files);
    await deploy(await setup(), config, 5, 7, live, {
      fetcher: liveCalls.fetcher,
      run: failing(),
    });
    expect(liveCalls.calls.some((c) => c.path.endsWith('/issues'))).toBe(true);
    const previewCalls = github(files);
    await deploy(await setup(), config, 5, 7, preview, {
      fetcher: previewCalls.fetcher,
      run: failing(),
    });
    expect(previewCalls.calls.at(-1)?.body['conclusion']).toBe('success');
  });

  it.each([
    ['has no address', { url: null }],
    ['has no commit', { sha: null }],
    ['is on a private address', { url: 'https://192.168.0.5/' }],
    ['is on a bare name', { url: 'https://localhost/' }],
  ])('checks nothing when the deployment %s', async (_name, change) => {
    const { fetcher, calls } = github();
    let ran = false;
    await deploy(
      await setup(),
      config,
      5,
      7,
      { ...preview, ...change },
      {
        fetcher,
        run: async () => {
          ran = true;
          return failing()();
        },
      },
    );
    expect(ran).toBe(false);
    expect(calls.some((c) => c.path.endsWith('/check-runs'))).toBe(false);
  });

  it('does not even ask GitHub for a token when there is nothing to check', async () => {
    const { fetcher, calls } = github();
    await deploy(
      await setup(),
      config,
      5,
      7,
      { ...preview, url: null },
      { fetcher, run: failing() },
    );
    await deploy(
      await setup(),
      config,
      5,
      7,
      { ...preview, sha: null },
      { fetcher, run: failing() },
    );
    expect(calls).toEqual([]);
  });

  it('says on the commit that the preview could not be reached', async () => {
    const { fetcher, calls } = github();
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await deploy(await setup(), config, 5, 7, preview, {
      fetcher,
      run: async () => {
        throw new Error('401');
      },
    });
    expect(calls.at(-1)?.body).toMatchObject({
      conclusion: 'neutral',
      output: { title: 'The preview could not be reached' },
    });
    expect(error).toHaveBeenCalled();
  });

  it('logs a failure to create the check run and does not throw', async () => {
    const { fetcher } = github({}, { '/check-runs': 403 });
    const error = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    await expect(
      handleDeployment(await setup(), config, 5, 7, preview, {
        fetcher,
        run: failing(),
      }),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith(
      'check run failed',
      'acme/site',
      expect.anything(),
    );
  });
});
