import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { CHECKS, checksInGroup } from '@/domain/checks/catalogue';
import type { Database } from '@/domain/db/client';
import { addDomain, getDomain, setDomainChecks } from '@/domain/db/domains';
import { replaceAccess } from '@/domain/db/access';
import type { User } from '@/domain/db/users';
import {
  CLI_COMMAND,
  callTool,
  callToolOrExplain,
} from '@/domain/mcp/tool-calls';
import { domainLink, type ToolResult } from '@/domain/mcp/tool-results';
import { BackendFailure, InvalidToolArguments, UnknownTool } from '@/lib/mcp';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

const USER = { id: 1 } as User;
const STRANGER = { id: 2 } as User;
const TOTAL = CHECKS.length;
const TLS = checksInGroup('tls').length;

/** A fresh database, and a way to call a tool against it. */
function setup() {
  const { db, raw } = sqliteDatabase(...APP_MIGRATIONS);
  const call = (
    name: string,
    args?: unknown,
    user: Readonly<User> = USER,
  ): Promise<ToolResult> =>
    callTool(
      user,
      args === undefined ? { name } : { name, arguments: args },
      () => db,
    );
  return { db, raw, call };
}

/** The text of a result. */
function textOf(result: ToolResult): string {
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

/** A database that throws on every query. */
const broken = (): Database => {
  throw new Error('D1 is down');
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('callTool — the request', () => {
  it.each([
    ['no name', {}],
    ['an empty name', { name: '' }],
    ['a name that is not text', { name: 7 }],
  ])('refuses %s as a malformed call', async (_label, params) => {
    await expect(callTool(USER, params, broken)).rejects.toBeInstanceOf(
      InvalidToolArguments,
    );
  });

  it('refuses a call with no parameters at all', async () => {
    await expect(callTool(USER, undefined, broken)).rejects.toBeInstanceOf(
      InvalidToolArguments,
    );
  });

  it('refuses a tool it does not have', async () => {
    await expect(
      callTool(USER, { name: 'make_coffee' }, broken),
    ).rejects.toBeInstanceOf(UnknownTool);
  });

  it.each([
    ['text', 'x'],
    ['a list', []],
    ['null', null],
  ])(
    'refuses arguments that are %s as a malformed call',
    async (_label, args) => {
      await expect(
        callTool(USER, { name: 'list_domains', arguments: args }, broken),
      ).rejects.toBeInstanceOf(InvalidToolArguments);
    },
  );

  it('answers arguments that do not fit as an error the model can read', async () => {
    const result = await setup().call('get_domain', { limit: 5 });
    expect(result.isError).toBe(true);
  });

  it('says what was wrong and what the tool takes', async () => {
    const result = await setup().call('get_domain', {});
    expect(textOf(result)).toMatch(
      /^Invalid arguments for get_domain: .*`domain` is required.*The arguments are: domain \(required\)\.$/,
    );
  });

  it('says when a tool takes no arguments', async () => {
    expect(
      textOf(await setup().call('list_domains', { domain: 'example.com' })),
    ).toMatch(/This tool takes no arguments\.$/);
  });

  it('opens no database for arguments that do not fit', async () => {
    const open = jest.fn(broken);
    await callTool(USER, { name: 'get_domain', arguments: {} }, open);
    expect(open).not.toHaveBeenCalled();
  });

  it('opens no database to list the checks', async () => {
    const open = jest.fn(broken);
    await callTool(USER, { name: 'list_checks' }, open);
    expect(open).not.toHaveBeenCalled();
  });

  it('reports a database that fails as a backend failure', async () => {
    await expect(
      callTool(USER, { name: 'list_domains' }, broken),
    ).rejects.toBeInstanceOf(BackendFailure);
  });

  it('accepts a host given under its other spelling', async () => {
    const { db, call } = setup();
    await addDomain(db, USER.id, 'example.com');
    expect((await call('get_domain', { host: 'example.com' })).isError).toBe(
      undefined,
    );
  });
});

describe('callToolOrExplain', () => {
  it('explains a database failure to the assistant, as a tool error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await callToolOrExplain(
      USER,
      { name: 'list_domains' },
      broken,
    );
    expect(result).toEqual({
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Something went wrong with the database, so that did not work. Try again in a minute; if it keeps failing, tell the user to open https://plumbline.apps.mrida.ng.',
        },
      ],
    });
  });

  it('keeps what failed out of the answer, and in the log', async () => {
    const log = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const result = await callToolOrExplain(
      USER,
      { name: 'list_domains' },
      broken,
    );
    expect(textOf(result)).not.toContain('D1 is down');
    expect(JSON.stringify(log.mock.calls)).toContain('D1 is down');
  });

  it('still throws an unknown tool for the router to answer', async () => {
    await expect(
      callToolOrExplain(USER, { name: 'make_coffee' }, broken),
    ).rejects.toBeInstanceOf(UnknownTool);
  });

  it('passes a working call through unchanged', async () => {
    const { db } = setup();
    expect(
      await callToolOrExplain(USER, { name: 'list_domains' }, () => db),
    ).toEqual(await callTool(USER, { name: 'list_domains' }, () => db));
  });
});

describe('list_checks', () => {
  it('starts with the groups', async () => {
    expect(textOf(await setup().call('list_checks')).split('\n', 1)[0]).toMatch(
      /^Groups: .*\btls\b.*\.$/,
    );
  });

  it('shows the first page of every check, and where the next starts', async () => {
    const text = textOf(await setup().call('list_checks', {}));
    expect(text).toContain(`${TOTAL} checks; showing 50 from 0.`);
    expect(text).toContain('More: call again with offset 50.');
  });

  it('describes each check with its id, name, groups and description', async () => {
    expect(
      textOf(await setup().call('list_checks', { query: 'ads.txt' })),
    ).toContain(
      '- ads-txt: Valid ads.txt [iab, seo] Checks that /ads.txt follows the IAB Tech Lab ads.txt 1.1 spec.',
    );
  });

  it('narrows the list to one group, without the list of groups', async () => {
    const text = textOf(await setup().call('list_checks', { group: 'tls' }));
    expect(text.split('\n', 1)[0]).toBe(
      `${TLS} checks in tls; showing ${TLS} from 0.`,
    );
  });

  it('refuses a group that does not exist, naming the ones that do', async () => {
    const result = await setup().call('list_checks', { group: 'nope' });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(
      /^There is no group "nope"\. The groups are .*tls/,
    );
  });

  it('finds checks by any case of the text', async () => {
    expect(
      textOf(await setup().call('list_checks', { query: 'ADS.TXT' })),
    ).toContain('- ads-txt:');
  });

  it('says when no check matches', async () => {
    expect(textOf(await setup().call('list_checks', { query: 'zzzzzz' }))).toBe(
      '0 checks matching "zzzzzz"; showing 0 from 0.',
    );
  });

  it('reads the next page from an offset, without the list of groups', async () => {
    const text = textOf(await setup().call('list_checks', { offset: 50 }));
    expect(text.split('\n', 1)[0]).toBe(`${TOTAL} checks; showing 50 from 50.`);
  });

  it('offers no next page after the last', async () => {
    expect(
      textOf(await setup().call('list_checks', { offset: TOTAL - 1 })),
    ).not.toContain('More:');
  });

  it('returns as many checks as asked for, up to the cap', async () => {
    const text = textOf(await setup().call('list_checks', { limit: 200 }));
    expect(text).toContain(`showing ${Math.min(200, TOTAL)} from 0.`);
  });

  it('returns a page as small as asked', async () => {
    expect(textOf(await setup().call('list_checks', { limit: 3 }))).toContain(
      'showing 3 from 0.',
    );
  });
});

describe('list_repositories', () => {
  it('says where to start when there is nothing to show', async () => {
    expect(textOf(await setup().call('list_repositories'))).toContain(
      'No repositories yet.',
    );
  });

  it('lists the sites of the user by repository, and those of repositories they can see', async () => {
    const { db, call } = setup();
    await addDomain(db, USER.id, 'mine.example');
    await addDomain(db, USER.id, 'own.example', 'acme/own');
    await addDomain(db, 2, 'shared.example', 'acme/shared');
    await addDomain(db, 2, 'hidden.example', 'acme/hidden');
    await replaceAccess(db, USER.id, ['acme/shared']);
    expect(textOf(await call('list_repositories'))).toBe(
      [
        'acme/own:',
        '  own.example: unchecked (0 errors, 0 warnings, 0 hints)',
        'acme/shared:',
        '  shared.example: unchecked (0 errors, 0 warnings, 0 hints)',
        'Added by hand:',
        '  mine.example: unchecked (0 errors, 0 warnings, 0 hints)',
      ].join('\n'),
    );
  });

  it('takes no arguments and changes nothing', async () => {
    const { call } = setup();
    expect((await call('list_repositories')).isError).not.toBe(true);
  });
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
    expect((await call('list_domains')).structuredContent).toMatchObject({
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
    expect(
      (await call('get_domain', { domain: given })).isError,
    ).toBeUndefined();
  });

  it('finds the domain by its id', async () => {
    const { call, domain } = await scanned();
    expect(
      (await call('get_domain', { domain: domain.id })).isError,
    ).toBeUndefined();
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
    expect(
      (await call('get_domain', { domain: 'example.com' }, STRANGER)).isError,
    ).toBe(true);
  });

  it('refuses another user’s domain, by id', async () => {
    const { call, domain } = await scanned();
    expect(
      (await call('get_domain', { domain: domain.id }, STRANGER)).isError,
    ).toBe(true);
  });

  it('refuses an address that is not a public domain, saying why', async () => {
    const result = await setup().call('get_domain', { domain: '192.168.1.1' });
    expect(textOf(result)).toBe(
      'domain: Enter a domain name, not an IP address.',
    );
  });
});

describe('get_report', () => {
  it('reads the newest report by default', async () => {
    const { call } = await scanned();
    expect(
      (await call('get_report', { domain: 'example.com' })).structuredContent,
    ).toMatchObject({ created_at: '2026-10-01T00:00:00.000Z' });
  });

  it('reads an older report by its id', async () => {
    const { call } = await scanned();
    expect(
      (await call('get_report', { domain: 'example.com', report: OLD_REPORT }))
        .structuredContent,
    ).toMatchObject({ created_at: '2026-09-01T00:00:00.000Z' });
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
    expect(
      (
        await call('get_report', {
          domain: 'example.com',
          report: '00000000-0000-4000-8000-0000000000cc',
        })
      ).isError,
    ).toBe(true);
  });

  it('refuses a domain the user does not have', async () => {
    expect(
      (await setup().call('get_report', { domain: 'example.com' })).isError,
    ).toBe(true);
  });
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
    expect(
      (await setup().call('list_reports', { domain: 'example.com' })).isError,
    ).toBe(true);
  });
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
    expect(
      (await setup().call('scan_domain', { domain: 'example.com' })).isError,
    ).toBe(true);
  });
});

describe('add_domain', () => {
  it('is not a tool: domains come from the GitHub sync', async () => {
    await expect(
      setup().call('add_domain', { domain: 'example.com' }),
    ).rejects.toThrow();
  });
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

describe('configure_checks', () => {
  /** The checks stored for example.com. */
  async function stored(db: Database, id: string) {
    return (await getDomain(db, USER.id, id))?.checks;
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
    expect(
      (
        await setup().call('configure_checks', {
          domain: 'example.com',
          all: true,
        })
      ).isError,
    ).toBe(true);
  });
});
