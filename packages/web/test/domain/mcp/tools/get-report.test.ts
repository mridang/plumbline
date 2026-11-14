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

describe('get_report', () => {
  it('reads the newest report by default', async () => {
    const { call } = await scanned();
    const result = await call('get_report', { domain: 'example.com' });
    expect(result.structuredContent).toMatchObject({
      created_at: '2026-10-01T00:00:00.000Z',
    });
  });

  it('reads an older report by its id', async () => {
    const { call } = await scanned();
    const result = await call('get_report', {
      domain: 'example.com',
      report: OLD_REPORT,
    });
    expect(result.structuredContent).toMatchObject({
      created_at: '2026-09-01T00:00:00.000Z',
    });
  });

  it('tells the model what failed', async () => {
    const { call } = await scanned();
    expect(
      textOf(await call('get_report', { domain: 'example.com' })),
    ).toContain('- No CSP. (https://example.com/)');
  });

  it('says when the domain has not been scanned, and how to scan it', async () => {
    const { db, call } = setup();
    await addDomain(db, USER.id, 'example.com');
    const result = await call('get_report', { domain: 'example.com' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      'example.com has not been scanned yet. Use scan_domain to see how to scan it.',
    );
  });

  it.each([
    ['not an id', 'latest'],
    ['the id of no report', '00000000-0000-4000-8000-0000000000ff'],
  ])('refuses a report that is %s', async (_label, report) => {
    const { call } = await scanned();
    expect(
      textOf(await call('get_report', { domain: 'example.com', report })),
    ).toBe(
      'example.com has no report with that id. Use list_reports to see them.',
    );
  });

  it('refuses a report of another of the user’s domains', async () => {
    const { db, raw, call } = await scanned();
    const { domain: other } = await addDomain(db, USER.id, 'example.org');
    seedReport(
      raw,
      other.id,
      '00000000-0000-4000-8000-0000000000cc',
      '2026-10-02T00:00:00.000Z',
    );
    const result = await call('get_report', {
      domain: 'example.com',
      report: '00000000-0000-4000-8000-0000000000cc',
    });
    expect(result.isError).toBe(true);
  });

  it('refuses a domain the user does not have', async () => {
    const result = await setup().call('get_report', { domain: 'example.com' });
    expect(result.isError).toBe(true);
  });
});
