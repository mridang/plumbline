import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import { latestRuns, recordRun } from '@/domain/db/suite';
import {
  DEBOUNCE_MS,
  MAX_SITES,
  checkDeployment,
  checkSite,
  classifyDeployment,
} from '@/domain/suite/deploy';
import type { SuiteRun } from '@/domain/suite/run';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const deployed = { repo: 'acme/site', sha: 'abc123' };

/** Rules of the recommended set, one for each finding of a run. */
const RULES = [
  'seo-viewport',
  'seo-links',
  'seo-deprecated-html',
  'seo-http-status',
];

/** A run that found `messages`, each as a warning of its own check. */
const finding = (...messages: string[]): SuiteRun => ({
  url: 'https://x.test/',
  status: 200,
  hash: messages.join('|'),
  checks: messages.map((message, i) => ({
    id: RULES[i] ?? 'seo-viewport',
    findings: [{ severity: 'warning', message }],
  })),
});

const setup = async (...hosts: string[]) => {
  const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
  for (const host of hosts) {
    await addDomain(db, 1, host, 'acme/site');
  }
  return db;
};

describe('classifyDeployment', () => {
  const status = (
    state: string,
    environment: string,
    more: Record<string, unknown> = {},
  ) => ({
    deployment_status: { state, environment, ...more },
    deployment: { sha: 'abc' },
    repository: { full_name: 'acme/site' },
  });

  it('calls a successful deployment of the live site production', () => {
    expect(classifyDeployment(status('success', 'Production'))).toEqual({
      environment: 'production',
      repo: 'acme/site',
      sha: 'abc',
      url: null,
    });
  });

  it.each(['pending', 'failure', 'in_progress'])(
    'ignores state %s',
    (state) => {
      expect(classifyDeployment(status(state, 'Production'))).toBeNull();
    },
  );

  it.each([
    'Preview',
    'staging',
    'dev',
    'Review App',
    'pr-12',
    'pull-request-12',
    'pull request 3',
  ])('calls the %s environment a preview', (env) => {
    expect(classifyDeployment(status('success', env))?.environment).toBe(
      'preview',
    );
  });

  it('calls a short-lived deployment a preview whatever it is named', () => {
    expect(
      classifyDeployment({
        ...status('success', 'branch-x'),
        deployment: { sha: 'abc', transient_environment: true },
      })?.environment,
    ).toBe('preview');
  });

  it('does not take a name that merely contains pr for a preview', () => {
    expect(
      classifyDeployment(status('success', 'Production-Europe'))?.environment,
    ).toBe('production');
  });

  it('reads the address the deployment is reachable at, only when it is https', () => {
    expect(
      classifyDeployment(
        status('success', 'Preview', {
          environment_url: 'https://pr-3.site.test/',
        }),
      )?.url,
    ).toBe('https://pr-3.site.test/');
    expect(
      classifyDeployment(
        status('success', 'Preview', { target_url: 'https://t.site.test/' }),
      )?.url,
    ).toBe('https://t.site.test/');
    expect(
      classifyDeployment(
        status('success', 'Preview', { environment_url: 'http://plain.test/' }),
      )?.url,
    ).toBeNull();
    expect(
      classifyDeployment(
        status('success', 'Preview', { environment_url: 'not a url' }),
      )?.url,
    ).toBeNull();
  });

  it('ignores a delivery with no repository', () => {
    expect(
      classifyDeployment({ deployment_status: { state: 'success' } }),
    ).toBeNull();
  });

  it('takes the environment from the deployment when the status has none', () => {
    expect(
      classifyDeployment({
        deployment_status: { state: 'success' },
        deployment: { environment: 'preview' },
        repository: { full_name: 'acme/site' },
      })?.environment,
    ).toBe('preview');
  });
});

describe('checkDeployment', () => {
  it('runs the checks on each site of the repository and stores what they found', async () => {
    const db = await setup('a.test', 'b.test');
    const urls: string[] = [];
    const outcomes = await checkDeployment(db, 1, deployed, {
      run: async (url) => {
        urls.push(url);
        return finding('slow');
      },
    });
    expect(urls).toEqual(['https://a.test/', 'https://b.test/']);
    expect(outcomes.map((o) => o.host)).toEqual(['a.test', 'b.test']);
    const [stored] = await latestRuns(db, 1, 'a.test');
    expect(stored).toMatchObject({
      repo: 'acme/site',
      sha: 'abc123',
      status: 200,
    });
    expect(stored?.findings.map((f) => f.message)).toEqual(['slow']);
  });

  it('says what the deployment broke and what it fixed', async () => {
    const db = await setup('a.test');
    await recordRun(
      db,
      {
        userId: 1,
        host: 'a.test',
        repo: 'acme/site',
        sha: 'old',
        status: 200,
        hash: 'old',
        findings: [
          { id: 'seo-viewport', severity: 'warning', message: 'old problem' },
        ],
      },
      '2026-01-01T00:00:00.000Z',
    );
    const [outcome] = await checkDeployment(db, 1, deployed, {
      run: async () => finding('new problem'),
      now: () => new Date('2026-01-02T00:00:00.000Z'),
    });
    expect(outcome?.changes?.added.map((f) => f.message)).toEqual([
      'new problem',
    ]);
    expect(outcome?.changes?.fixed.map((f) => f.message)).toEqual([
      'old problem',
    ]);
  });

  it('skips a site that was checked a moment ago', async () => {
    const db = await setup('a.test');
    const start = new Date('2026-01-01T00:00:00.000Z');
    let runs = 0;
    const run = async () => {
      runs += 1;
      return finding();
    };
    await checkDeployment(db, 1, deployed, { run, now: () => start });
    const soon = new Date(start.getTime() + DEBOUNCE_MS - 1);
    const [outcome] = await checkDeployment(db, 1, deployed, {
      run,
      now: () => soon,
    });
    expect(outcome).toEqual({ host: 'a.test', skipped: 'recent' });
    const later = new Date(start.getTime() + DEBOUNCE_MS);
    await checkDeployment(db, 1, deployed, { run, now: () => later });
    expect(runs).toBe(2);
  });

  it('records nothing for a site that cannot be reached and goes on to the next', async () => {
    const db = await setup('a.test', 'b.test');
    const outcomes = await checkDeployment(db, 1, deployed, {
      run: async (url) => {
        if (url.includes('a.test')) {
          throw new Error('down');
        }
        return finding();
      },
    });
    expect(outcomes).toEqual([
      { host: 'a.test', skipped: 'unreachable' },
      expect.objectContaining({ host: 'b.test' }),
    ]);
    expect(await latestRuns(db, 1, 'a.test')).toEqual([]);
  });

  it('checks no more than the limit in one delivery', async () => {
    const hosts = Array.from({ length: MAX_SITES + 2 }, (_, i) => `h${i}.test`);
    const db = await setup(...hosts);
    const outcomes = await checkDeployment(db, 1, deployed, {
      run: async () => finding(),
    });
    expect(outcomes).toHaveLength(MAX_SITES);
  });

  it("checks only the person's sites found in that repository", async () => {
    const db = await setup('a.test');
    await addDomain(db, 1, 'by-hand.test');
    await addDomain(db, 2, 'theirs.test', 'acme/site');
    const outcomes = await checkDeployment(db, 1, deployed, {
      run: async () => finding(),
    });
    expect(outcomes.map((o) => o.host)).toEqual(['a.test']);
  });
});

describe('checkDeployment, the sites together and the commits apart', () => {
  it('checks a new commit a moment after the run of another one', async () => {
    const db = await setup('a.test');
    const start = new Date('2026-01-01T00:00:00.000Z');
    let runs = 0;
    const run = async () => {
      runs += 1;
      return finding();
    };
    await checkDeployment(
      db,
      1,
      { repo: 'acme/site', sha: 'one' },
      { run, now: () => start },
    );
    const [outcome] = await checkDeployment(
      db,
      1,
      { repo: 'acme/site', sha: 'two' },
      { run, now: () => new Date(start.getTime() + 1000) },
    );
    expect(outcome?.skipped).toBeUndefined();
    expect(runs).toBe(2);
  });

  it('checks the sites at the same time, not one after another', async () => {
    const db = await setup('a.test', 'b.test', 'c.test');
    let running = 0;
    let most = 0;
    const outcomes = await checkDeployment(db, 1, deployed, {
      run: async () => {
        running += 1;
        most = Math.max(most, running);
        await new Promise((resolve) => setTimeout(resolve, 10));
        running -= 1;
        return finding();
      },
    });
    expect(most).toBe(3);
    expect(outcomes.map((o) => o.host)).toEqual(['a.test', 'b.test', 'c.test']);
  });

  it('checks even a site checked a moment ago when forced', async () => {
    const db = await setup('a.test');
    const start = new Date('2026-01-01T00:00:00.000Z');
    let runs = 0;
    const run = async () => {
      runs += 1;
      return finding();
    };
    await checkDeployment(db, 1, deployed, { run, now: () => start });
    await checkDeployment(db, 1, deployed, {
      run,
      now: () => start,
      force: true,
    });
    expect(runs).toBe(2);
  });
});

describe('checkSite', () => {
  it('keeps the previous findings when the page has not changed', async () => {
    const db = await setup('a.test');
    const site = { host: 'a.test', repo: 'acme/site', sha: null };
    await checkSite(db, 1, site, { run: async () => finding('slow') });
    const seen: (string | null)[] = [];
    const outcome = await checkSite(db, 1, site, {
      run: async (_url, hash) => {
        seen.push(hash);
        return {
          url: 'https://a.test/',
          status: 200,
          hash: 'slow',
          checks: null,
        };
      },
    });
    expect(seen).toEqual(['slow']);
    expect(outcome).toMatchObject({ unchanged: true });
    expect(outcome.changes).toEqual({ added: [], fixed: [] });
    const [latest] = await latestRuns(db, 1, 'a.test', 1);
    expect(latest?.findings.map((f) => f.message)).toEqual(['slow']);
  });

  it('applies the levels of the rules to what the checks found', async () => {
    const db = await setup('a.test');
    const site = { host: 'a.test', repo: 'acme/site', sha: null };
    const run = async (): Promise<SuiteRun> => ({
      url: 'https://a.test/',
      status: 200,
      hash: 'h',
      checks: [
        { id: 'seo-viewport', findings: [{ severity: 'hint', message: 'a' }] },
        { id: 'seo-links', findings: [{ severity: 'hint', message: 'b' }] },
        {
          id: 'seo-http-status',
          findings: [{ severity: 'hint', message: 'c' }],
        },
        {
          id: 'seo-content-length',
          findings: [{ severity: 'error', message: 'd' }],
        },
      ],
    });
    const outcome = await checkSite(db, 1, site, {
      run,
      levels: new Map([
        ['seo-viewport', 'error'],
        ['seo-links', 'warn'],
        ['seo-http-status', 'on'],
      ]),
    });
    expect(outcome.findings).toEqual([
      { id: 'seo-viewport', severity: 'error', message: 'a' },
      { id: 'seo-links', severity: 'warning', message: 'b' },
      { id: 'seo-http-status', severity: 'hint', message: 'c' },
    ]);
  });

  it('reads an unchanged page again when the rules are not the ones of the previous run', async () => {
    const db = await setup('a.test');
    const site = { host: 'a.test', repo: 'acme/site', sha: null };
    await checkSite(db, 1, site, {
      run: async () => finding('slow'),
      levels: new Map([['seo-viewport', 'on']]),
    });
    const seen: (string | null)[] = [];
    const run = async (
      _url: string,
      hash: string | null,
    ): Promise<SuiteRun> => {
      seen.push(hash);
      return finding('slow');
    };
    await checkSite(db, 1, site, {
      run,
      levels: new Map([['seo-viewport', 'warn']]),
    });
    await checkSite(db, 1, site, {
      run,
      levels: new Map([['seo-viewport', 'warn']]),
    });
    expect(seen).toEqual([null, 'slow']);
  });

  it('reads the page when it has no earlier run to compare with', async () => {
    const db = await setup('a.test');
    const outcome = await checkSite(
      db,
      1,
      { host: 'a.test', repo: null, sha: null },
      {
        run: async () => ({
          url: 'https://a.test/',
          status: 200,
          hash: 'h',
          checks: null,
        }),
      },
    );
    expect(outcome.unchanged).toBe(false);
  });
});
