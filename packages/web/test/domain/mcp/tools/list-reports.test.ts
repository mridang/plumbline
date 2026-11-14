import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ToolContent } from '@/domain/mcp/tool-context';

import { addDomain } from '@/domain/db/domains';
import type { User } from '@/domain/db/users';
import { callTool } from '@/domain/mcp/tool-calls';
import { type ToolResult } from '@/domain/mcp/tool-results';

import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
import { sqliteDatabase } from '../../../lib/core/db/sqlite-db';

const USER = { id: 1 } as User;

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

describe('list_reports', () => {
  it('lists the reports newest first, with their ids and counts', async () => {
    const { call } = await scanned();
    expect(textOf(await call('list_reports', { domain: 'example.com' }))).toBe(
      [
        '2 reports for example.com, newest first:',
        `- ${NEW_REPORT} (2026-10-01T00:00:00.000Z): 2 failed, 1 warned, 5 passed, 0 skipped`,
        `- ${OLD_REPORT} (2026-09-01T00:00:00.000Z): 2 failed, 1 warned, 5 passed, 0 skipped`,
      ].join('\n'),
    );
  });

  it('says when there are none', async () => {
    const { db, call } = setup();
    await addDomain(db, USER.id, 'example.com');
    expect(textOf(await call('list_reports', { domain: 'example.com' }))).toBe(
      'example.com has no saved reports yet.',
    );
  });

  it('refuses a domain the user does not have', async () => {
    const result = await setup().call('list_reports', {
      domain: 'example.com',
    });
    expect(result.isError).toBe(true);
  });
});
