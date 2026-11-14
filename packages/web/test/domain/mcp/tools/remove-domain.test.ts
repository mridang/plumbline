import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ToolContent } from '@/domain/mcp/tool-context';

import { addDomain, getDomain } from '@/domain/db/domains';
import type { User } from '@/domain/db/users';
import { callTool } from '@/domain/mcp/tool-calls';
import { type ToolResult } from '@/domain/mcp/tool-results';

import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
import { sqliteDatabase } from '../../../lib/core/db/sqlite-db';

const USER = { id: 1 } as User;
const STRANGER = { id: 2 } as User;

/** A fresh database, and a way to call a tool against it. */
function setup() {
  const { db, raw } = sqliteDatabase(...APP_MIGRATIONS);
  const call = (
    name: string,
    args?: unknown,
    user: Readonly<User> = USER,
  ): Promise<ToolResult<ToolContent>> =>
    callTool(user, args === undefined ? { name } : { name, arguments: args }, {
      openDatabase: () => db,
    });
  return { db, raw, call };
}

/** The text of a result. */
function textOf(result: ToolResult<ToolContent>): string {
  return result.content.map((block) => block.text).join('\n');
}

/** Save a report row with a fixed id and time. */
function seedReport(
  raw: ReturnType<typeof sqliteDatabase>['raw'],
  domainId: string,
  id: string,
  createdAt: string,
  userId = USER.id,
): void {
  raw
    .prepare(
      'INSERT INTO reports (id, domain_id, user_id, url, passed, warned, failed, skipped, outcomes, created_at) VALUES (?, ?, ?, ?, 5, 1, 2, 0, ?, ?)',
    )
    .run(
      id,
      domainId,
      userId,
      'https://example.com/',
      JSON.stringify([
        {
          id: 'csp',
          status: 'failed',
          findings: [
            {
              message: 'No CSP.',
              resource: 'https://example.com/',
              level: 'error',
            },
          ],
        },
      ]),
      createdAt,
    );
}

const OLD_REPORT = '00000000-0000-4000-8000-00000000000a';
const NEW_REPORT = '00000000-0000-4000-8000-00000000000b';

/** A database with example.com scanned twice. */
async function scanned() {
  const env = setup();
  const { domain } = await addDomain(env.db, USER.id, 'example.com');
  seedReport(env.raw, domain.id, OLD_REPORT, '2026-09-01T00:00:00.000Z');
  seedReport(env.raw, domain.id, NEW_REPORT, '2026-10-01T00:00:00.000Z');
  return { ...env, domain };
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('remove_domain', () => {
  it('says what it removed', async () => {
    const { call } = await scanned();
    expect(textOf(await call('remove_domain', { domain: 'example.com' }))).toBe(
      'Removed example.com and its saved reports.',
    );
  });

  it('removes the domain', async () => {
    const { db, call, domain } = await scanned();
    await call('remove_domain', { domain: 'example.com' });
    expect(await getDomain(db, USER.id, domain.id)).toBeUndefined();
  });

  it('removes the domain’s reports', async () => {
    const { raw, call } = await scanned();
    await call('remove_domain', { domain: 'example.com' });
    expect(raw.prepare('SELECT COUNT(*) AS n FROM reports').get()).toEqual({
      n: 0,
    });
  });

  it('leaves the user’s other domains alone', async () => {
    const { db, raw, call } = await scanned();
    const { domain: other } = await addDomain(db, USER.id, 'example.org');
    seedReport(
      raw,
      other.id,
      '00000000-0000-4000-8000-0000000000cc',
      '2026-10-02T00:00:00.000Z',
    );
    await call('remove_domain', { domain: 'example.com' });
    expect(raw.prepare('SELECT host FROM domains').all()).toEqual([
      { host: 'example.org' },
    ]);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM reports').get()).toEqual({
      n: 1,
    });
  });

  it('refuses a domain the user does not have', async () => {
    const { raw, call } = await scanned();
    const result = await call(
      'remove_domain',
      { domain: 'example.com' },
      STRANGER,
    );
    expect(result.isError).toBe(true);
    expect(raw.prepare('SELECT COUNT(*) AS n FROM domains').get()).toEqual({
      n: 1,
    });
  });
});
