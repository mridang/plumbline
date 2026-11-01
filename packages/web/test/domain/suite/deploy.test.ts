import { describe, expect, it } from '@jest/globals';

import { createDatabase } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import { latestRuns, recordRun } from '@/domain/db/suite';
import {
  DEBOUNCE_MS,
  MAX_SITES,
  checkDeployment,
  liveDeployment,
} from '@/domain/suite/deploy';
import type { SuiteRun } from '@/domain/suite/run';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteD1 } from '../../lib/core/db/sqlite-d1';

const deployed = { repo: 'acme/site', sha: 'abc123' };

/** A run that found `messages`, each as a warning of its own check. */
const finding = (...messages: string[]): SuiteRun => ({
  url: 'https://x.test/',
  status: 200,
  checks: messages.map((message, i) => ({
    id: `check-${i}`,
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

describe('liveDeployment', () => {
  const status = (state: string, environment: string) => ({
    deployment_status: { state, environment },
    deployment: { sha: 'abc' },
    repository: { full_name: 'acme/site' },
  });

  it('accepts a successful deployment of the live site', () => {
    expect(liveDeployment(status('success', 'Production'))).toEqual({
      repo: 'acme/site',
      sha: 'abc',
    });
  });

  it.each(['pending', 'failure', 'in_progress'])(
    'ignores state %s',
    (state) => {
      expect(liveDeployment(status(state, 'Production'))).toBeNull();
    },
  );

  it.each(['Preview', 'staging', 'dev'])(
    'ignores the %s environment',
    (env) => {
      expect(liveDeployment(status('success', env))).toBeNull();
    },
  );

  it('ignores a delivery with no repository', () => {
    expect(
      liveDeployment({ deployment_status: { state: 'success' } }),
    ).toBeNull();
  });

  it('takes the environment from the deployment when the status has none', () => {
    expect(
      liveDeployment({
        deployment_status: { state: 'success' },
        deployment: { environment: 'preview' },
        repository: { full_name: 'acme/site' },
      }),
    ).toBeNull();
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
        findings: [
          { id: 'check-0', severity: 'warning', message: 'old problem' },
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
