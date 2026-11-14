import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { ToolServices } from '@/domain/mcp/tool-services';
import type { ToolContent } from '@/domain/mcp/tool-context';

import type { Database } from '@/domain/db/client';
import { addDomain } from '@/domain/db/domains';
import type { User } from '@/domain/db/users';
import { callTool, callToolOrExplain } from '@/domain/mcp/tool-calls';
import { type ToolResult } from '@/domain/mcp/tool-results';
import {
  BackendFailureError,
  InvalidToolArgumentsError,
  UnknownToolError,
} from '@/lib/mcp';
import { APP_MIGRATIONS } from '../../lib/core/db/migrations';
import { sqliteDatabase } from '../../lib/core/db/sqlite-db';

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

/** A database that throws on every query. */
const brokenDatabase = (): Database => {
  throw new Error('D1 is down');
};

/** Services whose database cannot be opened, for the calls that never reach it. */
const brokenServices: ToolServices = { openDatabase: brokenDatabase };

afterEach(() => {
  jest.restoreAllMocks();
});

describe('callTool — the request', () => {
  it.each([
    ['no name', {}],
    ['an empty name', { name: '' }],
    ['a name that is not text', { name: 7 }],
  ])('refuses %s as a malformed call', async (_label, params) => {
    await expect(callTool(USER, params, brokenServices)).rejects.toBeInstanceOf(
      InvalidToolArgumentsError,
    );
  });

  it('refuses a call with no parameters at all', async () => {
    await expect(
      callTool(USER, undefined, brokenServices),
    ).rejects.toBeInstanceOf(InvalidToolArgumentsError);
  });

  it('refuses a tool it does not have', async () => {
    await expect(
      callTool(USER, { name: 'make_coffee' }, brokenServices),
    ).rejects.toBeInstanceOf(UnknownToolError);
  });

  it.each([
    ['text', 'x'],
    ['a list', []],
    ['null', null],
  ])(
    'refuses arguments that are %s as a malformed call',
    async (_label, args) => {
      await expect(
        callTool(
          USER,
          { name: 'list_domains', arguments: args },
          brokenServices,
        ),
      ).rejects.toBeInstanceOf(InvalidToolArgumentsError);
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
    const open = jest.fn(brokenDatabase);
    await callTool(
      USER,
      { name: 'get_domain', arguments: {} },
      { openDatabase: open },
    );
    expect(open).not.toHaveBeenCalled();
  });

  it('opens no database to list the checks', async () => {
    const open = jest.fn(brokenDatabase);
    await callTool(USER, { name: 'list_checks' }, { openDatabase: open });
    expect(open).not.toHaveBeenCalled();
  });

  it('reports a database that fails as a backend failure', async () => {
    await expect(
      callTool(USER, { name: 'list_domains' }, brokenServices),
    ).rejects.toBeInstanceOf(BackendFailureError);
  });

  it('accepts a host given under its other spelling', async () => {
    const { db, call } = setup();
    await addDomain(db, USER.id, 'example.com');
    const result = await call('get_domain', { host: 'example.com' });
    expect(result.isError).toBeUndefined();
  });
});

describe('callToolOrExplain', () => {
  it('explains a database failure to the assistant, as a tool error', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const result = await callToolOrExplain(
      USER,
      { name: 'list_domains' },
      brokenServices,
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
      brokenServices,
    );
    expect(textOf(result)).not.toContain('D1 is down');
    expect(JSON.stringify(log.mock.calls)).toContain('D1 is down');
  });

  it('still throws an unknown tool for the router to answer', async () => {
    await expect(
      callToolOrExplain(USER, { name: 'make_coffee' }, brokenServices),
    ).rejects.toBeInstanceOf(UnknownToolError);
  });

  it('passes a working call through unchanged', async () => {
    const { db } = setup();
    expect(
      await callToolOrExplain(
        USER,
        { name: 'list_domains' },
        { openDatabase: () => db },
      ),
    ).toEqual(
      await callTool(
        USER,
        { name: 'list_domains' },
        { openDatabase: () => db },
      ),
    );
  });
});

describe('add_domain', () => {
  it('is not a tool: domains come from the GitHub sync', async () => {
    await expect(
      setup().call('add_domain', { domain: 'example.com' }),
    ).rejects.toThrow();
  });
});
