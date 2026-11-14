import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ToolContent } from '@/domain/mcp/tool-context';

import { CHECKS } from '@/domain/checks/catalogue';
import { addDomain, setDomainChecks } from '@/domain/db/domains';
import type { User } from '@/domain/db/users';
import { callTool } from '@/domain/mcp/tool-calls';
import { domainLink, type ToolResult } from '@/domain/mcp/tool-results';

import { APP_MIGRATIONS } from '../../../lib/core/db/migrations';
import { sqliteDatabase } from '../../../lib/core/db/sqlite-db';
import { vector } from '../../../helpers/data.js';

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

describe('get_domain', () => {
  it('names the domain, its id and when it was added', async () => {
    const { call, domain } = await scanned();
    expect(
      textOf(await call('get_domain', { domain: 'example.com' })).split(
        '\n',
        1,
      )[0],
    ).toBe(`example.com (id ${domain.id}), added ${domain.created_at}.`);
  });

  it('says every check runs when none were chosen', async () => {
    const { call } = await scanned();
    expect(
      textOf(await call('get_domain', { domain: 'example.com' })),
    ).toContain(`Every check runs (${TOTAL}).`);
  });

  it('says how many checks run and which are off when some were chosen', async () => {
    const { db, call } = setup();
    const { domain } = await addDomain(db, USER.id, 'example.com');
    const keep = CHECKS.slice(2).map((c) => c.id);
    await setDomainChecks(db, USER.id, domain.id, keep);
    const text = textOf(await call('get_domain', { domain: 'example.com' }));
    expect(text).toContain(`${TOTAL - 2} of ${TOTAL} checks run.`);
    expect(text).toContain(`Switched off: ${CHECKS[0]?.id}, ${CHECKS[1]?.id}.`);
  });

  it('lists at most a hundred checks that are off, and counts the rest', async () => {
    const { db, call } = setup();
    const { domain } = await addDomain(db, USER.id, 'example.com');
    await setDomainChecks(db, USER.id, domain.id, []);
    expect(
      textOf(await call('get_domain', { domain: 'example.com' })),
    ).toContain(`, and ${TOTAL - 100} more.`);
  });

  it('says how the newest scan went', async () => {
    const { call } = await scanned();
    expect(
      textOf(await call('get_domain', { domain: 'example.com' })),
    ).toContain(
      'Newest scan 2026-10-01T00:00:00.000Z: 2 failed, 1 warned, 5 passed, 0 skipped.',
    );
  });

  it('says when the domain has not been scanned', async () => {
    const { db, call } = setup();
    await addDomain(db, USER.id, 'example.com');
    expect(
      textOf(await call('get_domain', { domain: 'example.com' })),
    ).toContain('Not scanned yet.');
  });

  it('links the domain’s page', async () => {
    const { call, domain } = await scanned();
    expect(
      textOf(await call('get_domain', { domain: 'example.com' })),
    ).toContain(`Page: ${domainLink(domain)}`);
  });

  it.each([
    ['a URL on it', 'https://Example.com/some/page'],
    ['a trailing dot', 'example.com.'],
  ])('finds the domain by %s', async (_label, given) => {
    const { call } = await scanned();
    const result = await call('get_domain', { domain: given });
    expect(result.isError).toBeUndefined();
  });

  it('finds the domain by its id', async () => {
    const { call, domain } = await scanned();
    const result = await call('get_domain', { domain: domain.id });
    expect(result.isError).toBeUndefined();
  });

  it('refuses a domain the user does not have, and says how to add it', async () => {
    const result = await setup().call('get_domain', { domain: 'example.com' });
    expect(result).toMatchObject({ isError: true });
    expect(textOf(result)).toBe(
      "example.com is not one of the user's domains. Use list_domains to see them.",
    );
  });

  it('refuses another user’s domain, by host', async () => {
    const { call } = await scanned();
    const result = await call(
      'get_domain',
      { domain: 'example.com' },
      STRANGER,
    );
    expect(result.isError).toBe(true);
  });

  it('refuses another user’s domain, by id', async () => {
    const { call, domain } = await scanned();
    const result = await call('get_domain', { domain: domain.id }, STRANGER);
    expect(result.isError).toBe(true);
  });

  it('refuses an address that is not a public domain, saying why', async () => {
    const result = await setup().call('get_domain', {
      domain: vector('ip192_168_1_1'),
    });
    expect(textOf(result)).toBe(
      'domain: Enter a domain name, not an IP address.',
    );
  });
});
