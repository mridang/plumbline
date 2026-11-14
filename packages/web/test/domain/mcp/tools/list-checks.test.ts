import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ToolContent } from '@/domain/mcp/tool-context';

import { CHECKS, checksInGroup } from '@/domain/checks/catalogue';
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

afterEach(() => {
  jest.restoreAllMocks();
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
