import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ToolContent } from '@/domain/mcp/tool-context';

import { addDomain } from '@/domain/db/domains';
import { replaceAccess } from '@/domain/db/access';
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

afterEach(() => {
  jest.restoreAllMocks();
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
    const result = await call('list_repositories');
    expect(result.isError).not.toBe(true);
  });
});
