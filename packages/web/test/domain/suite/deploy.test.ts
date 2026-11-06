import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import { getRun, listRuns } from '@/domain/db/runs';
import { dueSites, latestRuns, recordRun } from '@/domain/db/suite';
import {
  MAX_SITES,
  checkDeployment,
  checkSite,
  classifyDeployment,
} from '@/domain/suite/deploy';
import { PAID_LIMITS } from '@/domain/suite/limits';
import { RULE_SETS } from '@/domain/suite/rules';
import type { SuiteRun } from '@/domain/suite/run';
import { ScanFailed, SiteUnreachable } from '@/domain/suite/scanner';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const deployed = { repo: 'acme/site', sha: 'abc123' };

/** Rules of the recommended set, one for each finding of a run. */
const RULES = Object.keys(RULE_SETS['plumbline:recommended']!).slice(0, 4);

/** A run that found `messages`, each as a warning of its own check. */
const finding = (...messages: string[]): SuiteRun => ({
  url: 'https://x.test/',
  status: 200,
  hash: messages.join('|'),
  checks: messages.map((message, i) => ({
    id: RULES[i] ?? 'seo-viewport',
    findings: [{ severity: 'warning', message }],
  })),
  skipped: [],
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
    // The sites are checked together, so which request comes first is not fixed.
    expect(urls.toSorted()).toEqual(['https://a.test/', 'https://b.test/']);
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

  it('does not check a commit again, however long after, and checks a new one at once', async () => {
    const db = await setup('a.test');
    const start = new Date('2026-01-01T00:00:00.000Z');
    let runs = 0;
    const run = async () => {
      runs += 1;
      return finding();
    };
    await checkDeployment(db, 1, deployed, { run, now: () => start });
    const much = new Date(start.getTime() + 400 * 24 * 60 * 60 * 1000);
    const [outcome] = await checkDeployment(db, 1, deployed, {
      run,
      now: () => much,
    });
    expect(outcome).toEqual({ host: 'a.test', skipped: 'recent' });
    expect(runs).toBe(1);
    await checkDeployment(
      db,
      1,
      { ...deployed, sha: 'def456' },
      { run, now: () => new Date(start.getTime() + 1000) },
    );
    expect(runs).toBe(2);
  });

  it('checks a commit again when asked to, because the rules changed', async () => {
    const db = await setup('a.test');
    let runs = 0;
    const run = async () => {
      runs += 1;
      return finding();
    };
    await checkDeployment(db, 1, deployed, { run });
    await checkDeployment(db, 1, deployed, { run, force: true });
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

  it('checks more sites in one delivery on the Paid plan', async () => {
    const hosts = Array.from({ length: MAX_SITES + 2 }, (_, i) => `h${i}.test`);
    const db = await setup(...hosts);
    const outcomes = await checkDeployment(db, 1, deployed, {
      run: async () => finding(),
      limits: PAID_LIMITS,
    });
    expect(outcomes).toHaveLength(MAX_SITES + 2);
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

describe('checkSite and the history', () => {
  const run = async (): Promise<SuiteRun> => ({
    ...finding('slow'),
    counts: { passed: 8, warned: 1, failed: 0, skipped: 2 },
    outcomes: '[{"id":"seo-viewport","status":"warned","findings":[]}]',
  });
  const site = { host: 'a.test', repo: 'acme/site', sha: 'abc123' };

  /** The domain, and the runs listed for it. */
  const history = async (
    db: Awaited<ReturnType<typeof setup>>,
    domainId: string,
  ) => listRuns(db, 1, { domainId, host: 'a.test' }, 10);

  const withDomain = async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    const { domain } = await addDomain(db, 1, 'a.test', 'acme/site');
    return { db, domainId: domain.id };
  };

  it('records a deployment run with its commit, counts and outcomes, so it can be listed and opened', async () => {
    const { db, domainId } = await withDomain();
    await checkSite(db, 1, site, { run });
    expect(await history(db, domainId)).toEqual([
      expect.objectContaining({
        kind: 'deployment',
        sha: 'abc123',
        passed: 8,
        warned: 1,
        failed: 0,
        skipped: 2,
        openable: true,
      }),
    ]);
  });

  it('records a run forced by a change to the rules as a config run', async () => {
    const { db, domainId } = await withDomain();
    await checkSite(db, 1, site, { run, force: true });
    expect((await history(db, domainId))[0]?.kind).toBe('config');
  });

  it('records the kind it is given, and a run without counts or outcomes as one that cannot be opened', async () => {
    const { db, domainId } = await withDomain();
    await checkSite(db, 1, site, {
      run: async () => finding('slow'),
      kind: 'scheduled',
    });
    expect(await history(db, domainId)).toEqual([
      expect.objectContaining({
        kind: 'scheduled',
        passed: null,
        openable: false,
      }),
    ]);
  });
});

describe('checkSite', () => {
  it('calls a run unchanged when it found what the previous one did', async () => {
    const db = await setup('a.test');
    const site = { host: 'a.test', repo: 'acme/site', sha: null };
    const first = await checkSite(db, 1, site, {
      run: async () => finding('slow'),
    });
    expect(first.unchanged).toBe(false);
    const outcome = await checkSite(db, 1, site, {
      run: async () => finding('slow'),
    });
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
      skipped: [],
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

  it('does not call a run unchanged when the rules are not the ones of the previous run', async () => {
    const db = await setup('a.test');
    const site = { host: 'a.test', repo: 'acme/site', sha: null };
    const run = async () => finding('slow');
    await checkSite(db, 1, site, {
      run,
      levels: new Map([['seo-viewport', 'on']]),
    });
    const changed = await checkSite(db, 1, site, {
      run,
      levels: new Map([['seo-viewport', 'warn']]),
    });
    expect(changed.unchanged).toBe(false);
    const same = await checkSite(db, 1, site, {
      run,
      levels: new Map([['seo-viewport', 'warn']]),
    });
    expect(same.unchanged).toBe(true);
  });

  it('is not unchanged when there is no earlier run to compare with', async () => {
    const db = await setup('a.test');
    const outcome = await checkSite(
      db,
      1,
      { host: 'a.test', repo: null, sha: null },
      { run: async () => finding('slow') },
    );
    expect(outcome.unchanged).toBe(false);
  });
});

describe('checkSite, keeping only the checks the rules turn on', () => {
  const site = { host: 'a.test', repo: 'acme/site', sha: 'abc123' };
  const [enabled] = RULES;
  const outcomes = [
    { id: enabled!, status: 'warned', findings: [] },
    { id: 'not-in-the-rules', status: 'failed', findings: [] },
    { id: 'also-not-in-the-rules', status: 'passed', findings: [] },
  ];
  const run = async (): Promise<SuiteRun> => ({
    ...finding('one'),
    counts: { passed: 1, warned: 1, failed: 1, skipped: 0 },
    outcomes: JSON.stringify(outcomes),
    statuses: outcomes.map(({ id, status }) => ({
      id,
      status: status as 'warned' | 'failed' | 'passed',
    })),
  });

  it('counts and stores only the enabled checks, not what else the scanner ran', async () => {
    const db = createDatabase(sqliteD1(...APP_MIGRATIONS).d1);
    const { domain } = await addDomain(db, 1, 'a.test', 'acme/site');
    const levels = new Map<string, 'on'>([[enabled!, 'on']]);
    await checkSite(db, 1, site, { run, levels });
    const [kept] = await listRuns(
      db,
      1,
      { domainId: domain.id, host: 'a.test' },
      10,
    );
    expect(kept).toMatchObject({ passed: 0, warned: 1, failed: 0, skipped: 0 });
    const opened = await getRun(
      db,
      1,
      { domainId: domain.id, host: 'a.test' },
      kept!.id,
    );
    expect(opened?.outcomes).toEqual([outcomes[0]]);
  });

  it('leaves out of the not-run list the checks the rules do not ask for', async () => {
    const db = await setup('a.test');
    const result = await checkSite(db, 1, site, {
      run: async () => ({ ...finding('one'), skipped: [enabled!, 'other'] }),
      levels: new Map([[enabled!, 'on']]),
    });
    expect(result).toMatchObject({ notRun: [enabled] });
  });
});

describe('checkSite, telling the live dashboard', () => {
  /** A `Live` that writes down what it was told. */
  const recorder = () => {
    const told: unknown[] = [];
    return {
      told,
      live: {
        started: async (_user: number, site: { host: string }) => {
          told.push(['started', site.host]);
        },
        finished: async (
          _user: number,
          site: { host: string },
          change: { before: unknown; after: unknown; failed?: boolean },
        ) => {
          told.push([
            'finished',
            site.host,
            change.before,
            change.after,
            ...(change.failed ? ['failed'] : []),
          ]);
        },
      },
    };
  };
  const site = { host: 'a.test', repo: 'acme/site', sha: 'abc' };

  it('says a check began, then what it found against the check before', async () => {
    const db = await setup('a.test');
    await checkSite(db, 1, site, { run: async () => finding('one') });
    const { told, live } = recorder();
    await checkSite(db, 1, site, {
      run: async () => finding('one', 'two'),
      live,
    });
    expect(told).toEqual([
      ['started', 'a.test'],
      [
        'finished',
        'a.test',
        { errors: 0, warnings: 1, hints: 0 },
        { errors: 0, warnings: 2, hints: 0 },
      ],
    ]);
  });

  it('says a site did not answer when the scanner could not reach it', async () => {
    const db = await setup('a.test');
    const { told, live } = recorder();
    await checkSite(db, 1, site, {
      run: async () => {
        throw new SiteUnreachable('no answer');
      },
      live,
    });
    expect(told).toEqual([
      ['started', 'a.test'],
      ['finished', 'a.test', null, null],
    ]);
  });

  it('says the check failed, not the site, when the scanner broke', async () => {
    const db = await setup('a.test');
    const { told, live } = recorder();
    await checkSite(db, 1, site, {
      run: async () => {
        throw new ScanFailed('The scan stopped before it finished.');
      },
      live,
    });
    expect(told).toEqual([
      ['started', 'a.test'],
      ['finished', 'a.test', null, null, 'failed'],
    ]);
  });
});

describe('checkSite, when the scheduled re-check comes round', () => {
  const site = { host: 'a.test', repo: 'acme/site', sha: 'abc' };
  const dueAt = async (db: Awaited<ReturnType<typeof setup>>) =>
    (await dueSites(db, '9999-01-01T00:00:00.000Z', 10)).map((due) => due.host);
  const dueBefore = (db: Awaited<ReturnType<typeof setup>>) =>
    dueSites(db, '2026-11-06T00:00:00.000Z', 10).then((rows) =>
      rows.map((due) => due.host),
    );

  it('does not try a site that does not answer again until it is due', async () => {
    const db = await setup('a.test');
    await checkSite(db, 1, site, {
      now: () => new Date('2026-11-06T08:00:00.000Z'),
      run: async () => {
        throw new SiteUnreachable('no answer');
      },
    });
    expect(await dueBefore(db)).toEqual([]);
    expect(await dueAt(db)).toEqual(['a.test']);
  });

  it('keeps a site due when the scanner broke', async () => {
    const db = await setup('a.test');
    await checkSite(db, 1, site, {
      now: () => new Date('2026-11-06T08:00:00.000Z'),
      run: async () => {
        throw new ScanFailed('The scan stopped before it finished.');
      },
    });
    expect(await dueBefore(db)).toEqual(['a.test']);
  });
});

describe('checkSite, a check the scanner could not run', () => {
  const site = { host: 'a.test', repo: 'acme/site', sha: 'abc' };
  const previous = finding('old problem');
  const skippedNow = (): SuiteRun => ({
    url: 'https://x.test/',
    status: 200,
    hash: 'other',
    checks: [],
    skipped: [RULES[0]!],
  });

  it('keeps what the previous run found with that check, so a timeout does not look like a fix', async () => {
    const db = await setup('a.test');
    await checkSite(db, 1, site, { run: async () => previous });
    const outcome = await checkSite(db, 1, site, {
      run: async () => skippedNow(),
    });
    expect(outcome.findings?.map((f) => f.message)).toEqual(['old problem']);
    expect(outcome.changes).toEqual({ added: [], fixed: [] });
  });

  it('keeps nothing for a check whose rule is off now', async () => {
    const db = await setup('a.test');
    await checkSite(db, 1, site, {
      run: async () => previous,
      levels: new Map([[RULES[0]!, 'on']]),
    });
    const outcome = await checkSite(db, 1, site, {
      run: async () => skippedNow(),
      levels: new Map([[RULES[0]!, 'on']]),
    });
    expect(outcome.findings).toHaveLength(1);
    const off = await checkSite(db, 1, site, {
      run: async () => skippedNow(),
      levels: new Map([[RULES[1]!, 'on']]),
    });
    expect(off.findings).toEqual([]);
  });
});
