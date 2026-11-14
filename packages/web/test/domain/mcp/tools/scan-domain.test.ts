import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { CLI_COMMAND } from '@/domain/mcp/tools/domain-support';
import type { ToolContent } from '@/domain/mcp/tool-context';

import { addDomain } from '@/domain/db/domains';
import type { User } from '@/domain/db/users';
import { callTool } from '@/domain/mcp/tool-calls';
import { domainLink, type ToolResult } from '@/domain/mcp/tool-results';

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

describe('scan_domain', () => {
  it('links the page that runs the checks in the browser', async () => {
    const { call, domain } = await scanned();
    expect(
      textOf(await call('scan_domain', { domain: 'example.com' })),
    ).toContain(`open ${domainLink(domain)} and press "Run checks"`);
  });

  it('gives the CLI command for a full scan', async () => {
    const { call } = await scanned();
    expect(
      textOf(await call('scan_domain', { domain: 'example.com' })),
    ).toContain(`\`${CLI_COMMAND} example.com\``);
  });

  it('runs nothing and changes nothing', async () => {
    const { raw, call } = await scanned();
    await call('scan_domain', { domain: 'example.com' });
    expect(raw.prepare('SELECT COUNT(*) AS n FROM reports').get()).toEqual({
      n: 2,
    });
  });

  it('refuses a domain the user does not have', async () => {
    const result = await setup().call('scan_domain', { domain: 'example.com' });
    expect(result.isError).toBe(true);
  });
});
