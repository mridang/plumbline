import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ToolContent } from '@/domain/mcp/tool-context';

import { CHECKS, checksInGroup } from '@/domain/checks/catalogue';
import type { Database } from '@/domain/db/client';
import { addDomain, getDomain, setDomainChecks } from '@/domain/db/domains';
import type { User } from '@/domain/db/users';
import { callTool } from '@/domain/mcp/tool-calls';
import { type ToolResult } from '@/domain/mcp/tool-results';

import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
import { sqliteDatabase } from '../../../lib/core/db/sqlite-db';

const USER = { id: 1 } as User;
const TOTAL = CHECKS.length;
const TLS = checksInGroup('tls').length;

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

describe('configure_checks', () => {
  /** The checks stored for example.com. */
  async function stored(db: Database, id: string) {
    const found = await getDomain(db, USER.id, id);
    return found?.checks;
  }

  it('switches a group off', async () => {
    const { db, call, domain } = await scanned();
    await call('configure_checks', { domain: 'example.com', disable: ['tls'] });
    expect(await stored(db, domain.id)).toHaveLength(TOTAL - TLS);
  });

  it('says how many checks now run', async () => {
    const { call } = await scanned();
    expect(
      textOf(
        await call('configure_checks', {
          domain: 'example.com',
          disable: ['csp'],
        }),
      ),
    ).toMatch(
      new RegExp(
        String.raw`^example\.com now runs ${TOTAL - 1} of ${TOTAL} checks\. Changed off: `,
      ),
    );
  });

  it('names a few of the checks it changed, and says there were more', async () => {
    const { call } = await scanned();
    expect(
      textOf(
        await call('configure_checks', {
          domain: 'example.com',
          disable: ['tls'],
        }),
      ),
    ).toMatch(/, and more\.$/);
  });

  it('stores every check as all, so a check added later runs too', async () => {
    const { db, call, domain } = await scanned();
    await setDomainChecks(db, USER.id, domain.id, ['csp']);
    await call('configure_checks', { domain: 'example.com', all: true });
    expect(await stored(db, domain.id)).toBeNull();
  });

  it('says every check runs once all are on', async () => {
    const { call } = await scanned();
    expect(
      textOf(
        await call('configure_checks', {
          domain: 'example.com',
          enable: ['csp'],
        }),
      ),
    ).toContain(`now runs every check (${TOTAL})`);
  });

  it('starts from every check when asked to', async () => {
    const { db, call, domain } = await scanned();
    await setDomainChecks(db, USER.id, domain.id, ['csp']);
    await call('configure_checks', {
      domain: 'example.com',
      all: true,
      disable: ['csp'],
    });
    expect(await stored(db, domain.id)).toHaveLength(TOTAL - 1);
  });

  it('starts from the checks chosen now', async () => {
    const { db, call, domain } = await scanned();
    await setDomainChecks(db, USER.id, domain.id, ['csp']);
    await call('configure_checks', {
      domain: 'example.com',
      enable: ['ads-txt'],
    });
    expect(await stored(db, domain.id)).toEqual(['ads-txt', 'csp']);
  });

  it('takes one check given as text', async () => {
    const { db, call, domain } = await scanned();
    await call('configure_checks', { domain: 'example.com', disable: 'csp' });
    expect(await stored(db, domain.id)).not.toContain('csp');
  });

  it('refuses a name that is neither a check nor a group, changing nothing', async () => {
    const { db, call, domain } = await scanned();
    const result = await call('configure_checks', {
      domain: 'example.com',
      disable: ['csp', 'nope'],
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      'Not a check or a group: "nope". Use list_checks to see the ids and groups.',
    );
    expect(await stored(db, domain.id)).toBeNull();
  });

  it('refuses a domain the user does not have', async () => {
    const result = await setup().call('configure_checks', {
      domain: 'example.com',
      all: true,
    });
    expect(result.isError).toBe(true);
  });
});
