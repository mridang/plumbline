import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import type { ReactElement } from 'react';

import { createDatabase, type Database } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import { saveReport } from '@/domain/db/reports';
import type { RunSummary } from '@/domain/db/runs';
import { recordRun } from '@/domain/db/suite';

import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import {
  installCloudflareContext,
  sqliteD1,
} from '../../lib/core/db/sqlite-d1';
import { htmlAt } from '../render';

const state: { user: { id: number; email: string } | null } = { user: null };

jest.unstable_mockModule('@/lib/core/auth/current-user', () => ({
  getCurrentUser: async () => state.user,
}));

const { RunHistory, RunList } = await import('@/components/runs/run-history');

const run = (extra: Partial<RunSummary>): RunSummary => ({
  id: 's1',
  kind: 'deployment',
  ran_at: '2026-11-01T10:00:00.000Z',
  sha: 'abcdef1234567890',
  passed: 200,
  warned: 3,
  failed: 2,
  skipped: 1,
  openable: true,
  ...extra,
});

const list = (runs: RunSummary[]) =>
  htmlAt(
    RunList({
      repo: 'acme/site',
      domainId: 'd1',
      host: 'site.example.com',
      runs,
      base: '/repos/acme/site',
    }),
    { pathname: '/repos/acme/site' },
  );

describe('RunList', () => {
  it('shows when, the short commit linked to GitHub, how the run started and how it ended', () => {
    const html = list([run({})]);
    expect(html).toContain('1 Nov 2026');
    expect(html).toContain('>abcdef1</a>');
    expect(html).toContain(
      'href="https://github.com/acme/site/commit/abcdef1234567890"',
    );
    expect(html).toContain('Deployment');
    expect(html).toContain('2 failed');
    expect(html).toContain('3 warned');
    expect(html).toContain('200 passed');
  });

  it.each([
    ['manual', 'Manual'],
    ['deployment', 'Deployment'],
    ['scheduled', 'Scheduled'],
    ['config', 'Config change'],
  ] as const)('names a %s run %s', (kind, label) => {
    expect(list([run({ kind })])).toContain(label);
  });

  it('links a run that kept its report to it, and not one that did not', () => {
    const html = list([
      run({ id: 'abc', openable: true }),
      run({ id: 's2', openable: false }),
    ]);
    expect(html).toContain('href="/repos/acme/site?report=abc#site-d1"');
    expect(html).not.toContain('report=s2');
  });

  it('shows a dash for an unknown commit and for a count an older run did not keep', () => {
    const html = list([run({ sha: null, passed: null, skipped: null })]);
    expect(html).not.toContain('github.com/acme/site/commit');
    expect(html).toContain('– passed');
  });

  it('says so when a site has no runs yet', () => {
    expect(list([])).toContain('No runs of site.example.com yet');
  });
});

describe('RunHistory', () => {
  let db: Database;
  let restore: () => void;

  beforeEach(async () => {
    state.user = { id: 1, email: 'a@b.com' };
    const { d1 } = sqliteD1(...APP_MIGRATIONS);
    db = createDatabase(d1);
    restore = installCloudflareContext(d1);
    await addDomain(db, 1, 'site.example.com', 'acme/site');
    await addDomain(db, 1, 'other.example.com', 'acme/other');
  });
  afterEach(() => restore());

  const page = async (hosts: string[]): Promise<string> => {
    const element = await RunHistory({ repo: 'acme/site', hosts });
    return element === null
      ? ''
      : htmlAt(element as ReactElement, { pathname: '/repos/acme/site' });
  };

  it('lists the runs of each given site, manual and server ones together', async () => {
    const domain = (await addDomain(db, 1, 'site.example.com')).domain;
    await recordRun(db, {
      userId: 1,
      host: 'site.example.com',
      repo: 'acme/site',
      sha: 'abcdef1234567890',
      status: 200,
      hash: 'h',
      findings: [],
      kind: 'scheduled',
    });
    await saveReport(db, 1, domain.id, {
      url: 'https://site.example.com/',
      outcomes: [],
      passed: 1,
      warned: 0,
      failed: 0,
      skipped: 0,
    });
    const html = await page(['site.example.com']);
    expect(html).toContain('Run history');
    expect(html).toContain('Scheduled');
    expect(html).toContain('Manual');
    expect(html).not.toContain('other.example.com');
  });

  it('draws nothing for someone who is not signed in or has none of the hosts', async () => {
    expect(await page(['nobody.example.com'])).toBe('');
    state.user = null;
    expect(await page(['site.example.com'])).toBe('');
  });
});
