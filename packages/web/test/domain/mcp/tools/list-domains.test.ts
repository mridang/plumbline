import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ToolContent } from '@/domain/mcp/tool-context';

import { CHECKS } from '@/domain/checks/catalogue';
import { addDomain, setDomainChecks } from '@/domain/db/domains';
import type { User } from '@/domain/db/users';
import { callTool } from '@/domain/mcp/tool-calls';
import { type ToolResult } from '@/domain/mcp/tool-results';

import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
import { sqliteDatabase } from '../../../lib/core/db/sqlite-db';

const USER = { id: 1 } as User;
const STRANGER = { id: 2 } as User;
const TOTAL = CHECKS.length;

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

describe('list_domains', () => {
  it('says when the user has none', async () => {
    expect(textOf(await setup().call('list_domains'))).toBe(
      'The user has no domains yet.',
    );
  });

  it('lists each domain with its checks and its newest scan', async () => {
    const { call } = await scanned();
    expect(textOf(await call('list_domains'))).toBe(
      `- example.com: ${TOTAL} of ${TOTAL} checks; newest scan 2026-10-01T00:00:00.000Z: 2 failed, 1 warned, 5 passed, 0 skipped`,
    );
  });

  it('counts only the checks chosen for a domain', async () => {
    const { db, call } = setup();
    const { domain } = await addDomain(db, USER.id, 'example.com');
    await setDomainChecks(db, USER.id, domain.id, ['csp', 'ads-txt']);
    expect(textOf(await call('list_domains'))).toContain(
      `2 of ${TOTAL} checks; not scanned yet`,
    );
  });

  it('gives the view the list', async () => {
    const { call, domain } = await scanned();
    const result = await call('list_domains');
    expect(result.structuredContent).toMatchObject({
      total_checks: TOTAL,
      domains: [{ id: domain.id, host: 'example.com', checks: TOTAL }],
    });
  });

  it('lists only the user’s own domains', async () => {
    const { call } = await scanned();
    expect(textOf(await call('list_domains', {}, STRANGER))).toBe(
      'The user has no domains yet.',
    );
  });
});
